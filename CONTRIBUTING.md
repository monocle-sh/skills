# Maintain the skills

## Check the contract before editing

The runtime references are integration procedures, not copy-paste bootstraps pinned to a single OTel release. Check the installed dependencies when applying a skill. Only mark a framework combination as tested after exercising its real startup and decoded OTLP export.

Use these public sources for user-facing facts:

- [Monocle OTLP connection](https://monocle.sh/docs/opentelemetry/any-sdk)
- [Monocle semantic conventions](https://monocle.sh/docs/opentelemetry/semantic-conventions)
- [Monocle deployments](https://monocle.sh/docs/features/deployments)
- [Monocle AdonisJS](https://monocle.sh/docs/frameworks/adonisjs)
- [Monocle browser SDK](https://monocle.sh/docs/sdks/browser)
- The upstream OTel references linked in each language procedure.

Maintainers with access to the Monocle implementation must also check authentication, resource enrichment, exception bridging, metric filters, and dashboard classification before changing these rules. Users must not need that private source to apply the skills. The initial contract was reviewed against Monocle revision `0cadd1e505449a6274cad1f22def2c3de43ae775` on 2026-10-28. This records source inspection, not deployment or runtime certification.

When the contract changes, update onboarding's connection and signal references and audit's check registry together. Record the source revision and the affected behavior in the change description. Do not copy old ADRs over current implementation behavior.

## Keep the tasks separate

Onboarding changes the requested application. Audit is read-only unless the user requests fixes. Both skills must work without MCP and without the other skill installed. Add language details to the onboarding references rather than creating a skill per framework.

Keep required references inside their owning skill. Do not use symlinks or relative links to another skill. This small repository deliberately keeps the audit's own contract summary so that it remains independently installable.

Use English for all distributed content. Apply technical-writing and unslop guidance during authoring when available, but do not require users to install those skills.

## Validate documents

Run:

```sh
python3 scripts/validate.py
```

The validator checks the repository's single-line frontmatter format, names, descriptions, skill length, headings, fences, relative links, self-contained skill links, and credential-shaped strings. It is not a general Markdown or YAML parser, a complete secret scanner, a remote-link checker, or an OTel compatibility test.

## Review behavior before release

Use these cases when evaluating an agent with the skills installed. They are review scenarios, not a claim that an evaluation has already run.

| Request and context | Expected behavior |
| --- | --- |
| Install in a supported AdonisJS app with existing config | Reuse the official SDK and configuration. Do not add a second Node provider or permanently disable Studio. |
| Install in a Go API with pgx and no official Monocle package | Configure compatible native OTel. Check driver hooks and real query attributes. Do not build a reusable adapter. |
| Install in Rust with an existing subscriber | Preserve layers and logger destinations. Verify incoming context and decoded server kind, not only `TraceLayer` presence. |
| Install in Python with prefork workers | Check worker initialization and shutdown rather than starting exporter threads only in the parent process. |
| Install in a monorepo with no MCP | Inspect services, use supplied DSNs or explain how to obtain them, and finish safe local work. Do not pretend cloud export was verified. |
| Add telemetry without user identity or bodies | Keep those features off. Do not issue a long settings questionnaire or report deliberate omissions as defects. |
| Install without a DSN | No invented key or sentinel. Use local verification if possible and report the cloud blocker. |
| Audit missing SQL in staging | Inspect the targeted service, deployment, driver, native client kind, and DB attributes. Do not edit files or audit unrelated services. |
| Audit code that uses accepted legacy HTTP keys | Treat compatibility accurately. Do not declare a dashboard broken without evidence. |
| Audit one recovered database exception | Do not demand a new issue. Distinguish a child event from an unhandled entry failure. |
| Export is accepted while the budget is exhausted | Do not equate HTTP 2xx with stored records. |
| Ask for HTTP body capture | Request a bounded policy and consent. Do not enable blanket capture or consume streams. |

For an executed evaluation, record the model or agent, skill revision, fixture dependency versions, observations, and failures. Use synthetic data. Do not check in credentials or customer telemetry.

## Inspiration

The workflow organization was informed by [Maple onboarding](https://github.com/MapleTechLabs/maple/blob/main/skills/maple-onboard/SKILL.md) and [Maple audit](https://github.com/MapleTechLabs/maple/blob/main/skills/maple-audit/SKILL.md). Monocle uses its own authentication, routing, exception, and dashboard contracts. These skills do not install Maple resources or depend on Maple companion skills.
