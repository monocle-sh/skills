---
name: auditing-monocle
description: "Audits an existing Monocle or OpenTelemetry installation and diagnoses missing or incorrect telemetry. Use for instrumentation reviews, missing requests or queries, broken trace correlation, duplicate issues, and export problems. Read-only unless fixes are requested."
---

# Audit or diagnose Monocle telemetry

Find what the installation actually emits, what Monocle receives, and which user-visible feature is affected. Inspect first. Do not edit code, change configuration, create resources, or send test telemetry unless the user authorizes that action.

## 1. Select the scope

For a general audit, enumerate deployable services and classify each as instrumented, partial, not instrumented, or intentionally excluded. Compare against the requested coverage. A service without telemetry is not automatically a critical defect.

For a specific symptom, inspect the affected service and signal first. Do not turn a missing-query question into an unrelated monorepo audit. Establish the project, environment, time window, and deployed version when live data matters. Ask only for facts unavailable from the repository or connected tools.

Read [the check registry](reference/checks.md). For a targeted investigation, also read [the diagnosis procedure](reference/diagnosis.md). Both references are bundled here. This skill does not require the onboarding skill to be installed.

## 2. Inspect the active configuration

Read manifests, lockfiles, startup commands, deployment configuration, provider setup, instrumentation hooks, logger bridges, and lifecycle handlers. Follow configuration to the code path that is actually run.

Apply relevant checks, not every optional feature. Identify each enabled SDK and version. Check installed APIs before treating a configuration shape as valid. Separate a deliberate opt-out from a broken promise, an unsupported feature, and a missing verification step.

Never reproduce real DSNs, API keys, headers, bodies, prompts, or personal data in the report. Cite a redacted location instead.

## 3. Cross-check observations

Use existing read-only Monocle MCP tools when available. Discover current tool schemas, confirm the project, and query the affected service, environment, version, and bounded time window. Start with aggregate counts and narrow samples. Do not retrieve broad raw logs when counts or metadata answer the question.

Without MCP, finish the static audit and state which claims remain unverified. Do not install MCP mid-audit or assume Maple's `audit_setup` exists in Monocle.

Repository code and live data may describe different deployed versions or emitters. Neither automatically overrides the other. Resolve the discrepancy before naming a cause.

If reproduction requires starting the application or sending a synthetic operation, explain the proposed safe local test. Run it only within the user's authorized scope. Never trigger real payments, emails, production jobs, or infrastructure changes as a diagnostic probe.

## 4. Report findings before fixes

Each finding contains:

- A registry check ID, service, and affected feature.
- Severity based on actual impact and the user's intended coverage.
- Evidence from code, decoded export, or live observations, with safe file locations or bounded counts.
- A status: **confirmed**, **hypothesis**, or **not verified**.
- The smallest proposed fix and the check that would validate it.

Use **critical** for a confirmed security exposure or loss of required telemetry, **warning** for confirmed degradation, and **info** for optional improvements. Do not assign a confirmed failure severity to an unsupported hypothesis. State missing evidence.

For a targeted diagnosis, lead with the answer or the most likely remaining hypothesis. For a general audit, group findings by service and prioritize the fixes. Never fill the report with one warning per intentionally disabled option.

## 5. Stop or apply authorized fixes

For an audit-only request, stop after the findings. For an explicit fix request, make the smallest relevant change, preserve other vendors and application behavior, and rerun the failing scenario. Use the installed SDK documentation and [Monocle's conventions](https://monocle.sh/docs/opentelemetry/semantic-conventions) for the fix. Do not invent framework helpers or copy Maple's key mappings.

If configuration is missing entirely, recommend the onboarding workflow instead of generating a full adapter. If local verification succeeds but the deployed version has not changed, report that distinction. Do not deploy, rotate keys, change billing, commit, push, or publish unless separately authorized.
