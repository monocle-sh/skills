# Monocle skills

Agent skills for connecting an application to [Monocle](https://monocle.sh) and checking its telemetry.

| Skill | Use it to |
| --- | --- |
| [onboarding-monocle](skills/onboarding-monocle/SKILL.md) | Configure official SDKs or native OpenTelemetry in an application or monorepo. Includes Node.js, Go, Rust, and Python references. |
| [auditing-monocle](skills/auditing-monocle/SKILL.md) | Review an existing installation or investigate a specific missing or incorrect signal. Makes no changes unless requested. |

The onboarding skill configures applications. It does not ask users to build or publish Monocle adapters. Both skills work without the Monocle MCP. Each skill includes its own references and can be installed separately.

## Install in a project

This repository is private for now. The account used to clone it needs access. Do not put a GitHub token in a command or a project file.

Clone this repository outside the application you want to instrument:

```sh
git clone https://github.com/monocle-sh/skills.git monocle-skills
```

Copy the complete directory of each selected skill, including `reference/`, into the skill directory your agent supports. For agents that discover `.agents/skills/`, the resulting paths are:

```text
.agents/skills/onboarding-monocle/SKILL.md
.agents/skills/onboarding-monocle/reference/...
.agents/skills/auditing-monocle/SKILL.md
.agents/skills/auditing-monocle/reference/...
```

Keep existing skills intact. Follow your agent's reload instructions after installation. Installing only a `SKILL.md` loses the bundled references.

## Use the skills

Example requests:

- "Set up Monocle in this monorepo. Use the existing project and keep personal data out of telemetry."
- "Connect this Go API to Monocle with OpenTelemetry. I already have a DSN."
- "Audit this Monocle installation without editing files."
- "Find why PostgreSQL queries do not appear in Monocle for staging."

General onboarding includes technical instrumentation, authenticated user attribution with ID, email, and name when available, and source-map preparation for compiled JavaScript. Explicit opt-outs and project privacy restrictions take precedence. Analytics, replay, browser network capture, and business spans are optional. Other profile fields, HTTP bodies, headers, cookies, and AI content are not captured by default. Source-code uploads need authorization and a private project token.

The agent inspects before asking one grouped question about relevant optional coverage. If another vendor is installed, it asks which features to retain or replace before overlapping changes. CI and Docker are not required. Missing credentials or publication steps are reported with their feature impact and concrete next actions, without inventing deployment infrastructure.

## Validation status

This first draft documents the Monocle ingestion contract and language-specific integration procedures. The language references are not prebuilt bootstraps or a tested framework compatibility matrix. An agent must check the application's installed SDK APIs and execute the verification steps before claiming that an installation works.

Repository validation checks skill metadata, bundled links, and document structure. It does not prove that an application exports telemetry.

```sh
python3 scripts/validate.py
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for contract sources and behavioral review scenarios.

## Subscription-only evaluation pilot

See [evals/README.md](evals/README.md) to prepare two pinned AdonisJS fixtures and inspect the AXIS plan without starting an agent. Executing the pilot is a separate, explicit command that uses an existing Claude Code or Codex subscription login. It is not a tested framework compatibility claim.
