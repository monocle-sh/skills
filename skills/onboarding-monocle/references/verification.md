# Verify an installation

Use synthetic data, the real application bootstrap, and project-approved checks. Never trigger payments, customer mail, or production jobs. Test only agreed coverage. Analytics-only scope needs browser events, not server telemetry or an error probe. Confirm that existing instrumentation remains intact.

## Verify application export

1. Record the service, environment, runtime, SDK versions, and enabled signals without credentials.
2. Run targeted checks and start the application through its actual startup command.
3. Exercise a representative route, job, or command and its promised child operations. Inspect route templates, kinds, methods, and final status.
4. Exercise an unhandled failure and a recovered child failure. Verify exception details. The former produces one reportable failure, the latter no new issue. An error log alone does not prove issue reporting.
5. Emit a structured application log inside an active span. Decode its OTLP body, severity, business fields, and native trace and span IDs. Preserve correlation IDs and standard error details. Stdout and separate exception-reporter logs do not prove application log export.
6. If targeted redaction was necessary, verify a synthetic excluded value is absent while unrelated diagnostics survive. Do not introduce redaction merely to satisfy this check or use real secrets as probes.
7. For enabled metrics, cause a known measurement and wait for collection or a supported flush. Check the value, unit, name, and resource.
8. For promised cross-service traces, supply valid incoming W3C context and call a controlled downstream endpoint. Verify parentage and outgoing propagation, without sending ingestion credentials to application endpoints.
9. Shut down gracefully. Inspect export errors and partial-success responses. Confirm unchanged exit behavior.

A loopback Collector with HTTP reception and detailed debug output can decode real OTLP without a production DSN. A console exporter proves creation, not transport. A local receiver does not prove Monocle authorization or storage. Do not expose the receiver or record private telemetry.

For changed bootstrap, shutdown, or logger code, also check repeated initialization, concurrent context isolation, unavailable exporters, bounded shutdown, and diagnostic feedback loops. Keep behavior tests where the project supports them. Remove temporary probes and debug logging.

## Verify browser features

Check the selected features through the actual browser client:

- Errors emit and flush. Unselected collectors remain inactive.
- Network tracing preserves browser-to-server context and restricts propagation to intended hosts. A backend span alone proves neither.
- User attribution includes the permitted ID, email, and name fields when available, survives authentication and reload, replaces identity on account changes, and clears on logout. Check anonymous and concurrent server requests, and confirm excluded fields remain absent. Skip identity when excluded or analytics-only.
- Analytics produces one expected page view per navigation without personal event properties.
- Replay records nothing before consent, masks synthetic content after consent, and stops after withdrawal. Review the recording, not just an upload response.

Do not enable an unselected feature to test it. Configuration inspection alone does not verify an authentication or consent lifecycle.

## Verify builds and publication

Inspect the actual CI, platform build, or manual publication path. CI and Docker are not required. Check the real version source and the artifact's retained metadata.

For compiled JavaScript error coverage, check each relevant browser and server output. Verify debug-ID injection, the CI upload step or recap commands, private token handling, and exclusion of public `.map` files. Source maps match debug IDs, independently of deployment declarations.

With authorization and credentials, verify an original source frame from the matching deployed build in Monocle. A plugin entry or successful build does not prove upload or resolution. Report missing tokens, upload steps, deployed builds, and verified frames separately. Give the concrete next step and the check to rerun after publication. Do not create deployment infrastructure to close a verification gap.

For retained vendors, check initialization, provider ownership, patches, and duplicate events against installed versions. Report untested coexistence. Do not infer compatibility or memory conflicts from package presence.

## Verify cloud storage

With authorization, send a synthetic operation to the intended DSN and safe environment, usually `development`. Do not silently redirect the application.

1. Add a unique nonpersonal marker and wait for batching and ingestion.
2. Search the correct project, service, environment, and bounded time window.
3. Locate stored records for each claimed signal. Verify correlated logs and issues where selected, or browser events for analytics-only scope.
4. Confirm that recovered exceptions create no issue and reportable failures are not duplicated.

Discover available read-only Monocle MCP schemas or inspect the UI. Do not assume Maple tools exist. HTTP acceptance, `Last used`, or a fallback `setup_service` curl does not prove application storage. Check partial success, sampling, filters, time window, and budget before diagnosing a missing record.

## Report evidence and gaps

Use one status per service, limited to observed signals:

| Status | Required evidence |
| --- | --- |
| Cloud verified | Application emission and matching Monocle records for each claimed signal |
| Local export verified | Decoded application OTLP, with cloud checks pending |
| Not verified | Configuration, startup, console output, access checks, or incomplete observations only |

List defaults, selected additions, explicit exclusions, and blockers. Required logs remain a coverage gap when their bridge is disabled. Do not reclassify that gap as an optional omission.

Separate source-map configuration, upload, original-frame resolution, version metadata, and detected or declared deployments. A version observation is not exact deployment completion. Name each missing step and its feature impact without requesting secret values in chat. Distinguish observations from hypotheses.
