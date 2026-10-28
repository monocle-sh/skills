# Repository guidance

- Write skills, references, code, and examples in English.
- Keep two task boundaries: onboarding configures an application, auditing inspects an existing installation. Do not add a skill per language.
- Keep each skill independently installable. Bundle required references inside its own directory. Do not require sibling skills or private repositories at runtime.
- Keep `SKILL.md` short. Put language details and check registries in `reference/` and link them from the workflow.
- Apply technical-writing and unslop guidance when available. These are authoring aids, not installation requirements for users.
- Check Monocle's public documentation and the relevant implementation before changing ingestion rules. Record public sources in the reference that owns the rule.
- Prefer native OpenTelemetry configuration and existing SDKs. Do not generate a reusable Monocle adapter as part of application onboarding.
- Do not enable bodies, headers, cookies, AI content, or user identity without explicit consent. Do not include real credentials or private customer data in examples.
- Run `python3 scripts/validate.py` after edits. It checks documents only. Never describe language procedures as runtime-tested without recorded execution evidence.
- Keep temporary diagnostics and test data out of the repository.
