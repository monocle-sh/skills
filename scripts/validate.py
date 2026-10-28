"""Validate this repository's skill metadata and portable Markdown references."""

import json
from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlsplit


root = Path(__file__).resolve().parents[1]
errors = []
documents = sorted(root.glob("*.md")) + sorted((root / "skills").rglob("*.md"))
skills = sorted((root / "skills").glob("*/SKILL.md"))

if not skills:
    errors.append("No skills found")

for path in documents:
    label = path.relative_to(root).as_posix()
    source = path.read_text(encoding="utf-8")
    lines = source.splitlines()
    skill_root = None
    if path.is_relative_to(root / "skills"):
        skill_root = root / "skills" / path.relative_to(root / "skills").parts[0]

    if path.name == "SKILL.md":
        if len(lines) > 500:
            errors.append(f"{label}: SKILL.md exceeds 500 lines")
        if not lines or lines[0] != "---" or "---" not in lines[1:]:
            errors.append(f"{label}: missing YAML frontmatter")
        else:
            end = lines.index("---", 1)
            metadata = "\n".join(lines[1:end])
            name = re.search(r"^name: ([a-z0-9]+(?:-[a-z0-9]+)*)$", metadata, re.M)
            if not name or name[1] != path.parent.name or len(name[1]) > 64:
                errors.append(f"{label}: name must match its directory and skill naming rules")
            description = re.search(r'^description: (".*")$', metadata, re.M)
            try:
                value = json.loads(description[1]) if description else ""
                if not value or len(value) > 1024:
                    raise ValueError("empty or long description")
            except (ValueError, TypeError):
                errors.append(f"{label}: use a nonempty double-quoted single-line description")
            lines = lines[end + 1:]

    fence = None
    headings = []
    prose = []
    for number, line in enumerate(lines, 1):
        marker = re.match(r"^\s*(`{3,}|~{3,})", line)
        if marker:
            if fence is None:
                fence = marker[1]
            elif marker[1][0] == fence[0] and len(marker[1]) >= len(fence):
                fence = None
            continue
        if fence is not None:
            continue
        prose.append(line)
        heading = re.match(r"^(#{1,6}) ", line)
        if heading:
            level = len(heading[1])
            if headings and level > headings[-1] + 1:
                errors.append(f"{label}:{number}: skipped heading level")
            headings.append(level)

    if fence is not None:
        errors.append(f"{label}: unclosed code fence")
    if headings.count(1) != 1:
        errors.append(f"{label}: expected one H1 heading")

    for target in re.findall(r"\[[^\]]+\]\(([^\s)]+)\)", "\n".join(prose)):
        url = urlsplit(target)
        if url.scheme or url.netloc or not url.path:
            continue
        destination = (path.parent / unquote(url.path)).resolve()
        if not destination.is_file():
            errors.append(f"{label}: broken relative link {target}")
        if skill_root and not destination.is_relative_to(skill_root):
            errors.append(f"{label}: link leaves the installable skill: {target}")

    if re.search(r"mk_(?:live|test)_[A-Za-z0-9_-]{16,}", source):
        errors.append(f"{label}: credential-shaped value must be replaced with a placeholder")
    if skill_root and ("file://" in source or "/home/user/" in source):
        errors.append(f"{label}: private local path in distributed skill")

if errors:
    print("\n".join(errors), file=sys.stderr)
    sys.exit(1)

print(f"Validated {len(skills)} skills and {len(documents)} Markdown files")
