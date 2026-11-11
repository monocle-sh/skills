---
name: auditing-monocle
description: "Audits Monocle or OpenTelemetry installations and diagnoses missing telemetry, broken correlation, duplicate issues, and export problems. Read-only unless fixes are requested."
---

# Audit Monocle telemetry

Determine what the application emits, what Monocle stores, and which feature is affected. Do not edit configuration, create resources, or send test telemetry without authorization.

## 1. Define the scope

For a general audit, list deployable services and classify their coverage as instrumented, partial, absent, or intentionally excluded. Compare against agreed coverage, not every SDK feature.

If intent changes a finding and cannot be recovered, ask rather than assume.

General onboarding includes server traces, errors, existing application logs, supported metrics, and browser errors. Authenticated error coverage adds the user's ID, email, and name when available. Compiled JavaScript error coverage adds source-map preparation. Respect explicit exclusions and project restrictions.

Browser network, analytics, replay, extra console capture, and other profile fields require selection. Source uploads require authorization. An analytics-only request needs browser analytics, not new backend instrumentation. Preserve existing backend coverage.

For a specific symptom, start with the affected service and signal. Establish the project, environment, time window, and deployed version. Ask only for missing facts that affect the diagnosis.

Read [the check registry](references/checks.md) and, for a specific symptom, [the diagnosis procedure](references/diagnosis.md). Both references belong to this independently installable skill.

## 2. Inspect the active code

Follow manifests, startup commands, providers, hooks, logger bridges, and lifecycle handlers to the path that actually runs. Check installed SDK versions and APIs.

Preserve ordinary diagnostics. A correlation ID, business field, or `err` key alone is not a privacy defect. Flag concrete sensitive content and unnecessary custom filtering separately. Prefer SDK defaults and targeted native controls over global allowlists or custom processors.

For other vendors, inspect recorded retain-or-replace decisions, provider ownership, patches, and duplicate emissions. Package presence proves neither a memory conflict nor compatibility. Do not recommend removal without approval.

Keep credentials and private telemetry out of findings. Cite redacted file locations.

## 3. Cross-check observations

Discover read-only Monocle MCP schemas or inspect the UI. Query the correct service and bounded time window. Prefer counts and narrow samples over broad raw logs.

Without cloud access, finish the static audit and mark storage claims unverified. Do not install MCP or assume Maple's `audit_setup` exists. Resolve differences between repository and deployed versions before naming a cause.

Run reproductions only within authorization. Never use payments, customer mail, or production jobs as probes.

## 4. Report findings

For each finding, provide its check ID, service, feature impact, evidence, smallest fix, and validation check. Mark the conclusion as confirmed, hypothesis, or not verified. Write findings in your reply, not in project files.

Use critical severity for confirmed security exposure or loss of required telemetry, warning for confirmed degradation, and info for optional improvements. Do not report intentionally disabled options as failures.

For release readiness, distinguish version metadata, deployment observations, source-map preparation, upload, and original-frame resolution. CI and Docker are not prerequisites. Name the actual missing token, build, or publication step and when to rerun verification.

For audit-only requests, stop after findings. For authorized fixes, preserve application behavior and other vendors, then rerun the failing check. Use installed SDK documentation and [Monocle conventions](https://monocle.sh/docs/opentelemetry/semantic-conventions). Do not deploy, rotate keys, change billing, commit, push, or publish without separate authorization.
