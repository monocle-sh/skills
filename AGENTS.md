# Repository guidance

- Write skills, references, code, and examples in English.
- Keep two task boundaries: onboarding configures an application, auditing inspects an existing installation. Do not add a skill per language.
- Keep each skill independently installable. Bundle required references inside its own directory. Do not require sibling skills or private repositories at runtime.
- Keep `SKILL.md` short. Put stack details and check registries in `references/`, one file per lookup need, and list each one in the `SKILL.md` reference table.
- Apply technical-writing and unslop guidance when available. These are authoring aids, not installation requirements for users.
- Check Monocle's public documentation and the relevant implementation before changing ingestion rules. Record public sources in the reference that owns the rule.
- Prefer native OpenTelemetry configuration and existing SDKs. Do not generate a reusable Monocle adapter as part of application onboarding.
- Default error onboarding includes the authenticated user's ID, email, and name when available, plus the release version and source-map upload from CI secrets for compiled JavaScript. Never create a project token or ask users to paste one. Respect explicit exclusions and project privacy restrictions. Other profile fields, replay identity, bodies, headers, cookies, and AI content require explicit approval. Source-code uploads require authorization. Do not include real credentials or private customer data in examples.
- Run `python3 scripts/validate.py` after edits. It checks documents only. Never describe language procedures as runtime-tested without recorded execution evidence.
- Keep temporary diagnostics and test data out of the repository.
