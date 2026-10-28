# Verify an installation

Use synthetic data and the application's own start and test commands. Follow project restrictions on builds and other checks. Never run a payment, send real customer mail, or enqueue production work as a smoke test.

## Verify startup and emission

1. Record the target service, environment, runtime, SDK versions, and enabled signals. Keep credentials out of the record.
2. Run existing targeted checks. Start or import the application through its real telemetry bootstrap, not a separate script that bypasses it.
3. Exercise one representative route, job, or CLI operation. Confirm the route template, span kind, method, status, and child operations that were promised.
4. In an existing test or temporary local fixture, exercise an unhandled failure and a recovered child failure. Expect one reportable failure for the former and no new issue for the latter. A plain error log is not sufficient proof of exception reporting.
5. Emit a synthetic log inside an active span. Check its native trace and span IDs if log forwarding is enabled.
6. For enabled metrics, cause a known measurement and allow a collection interval or explicit supported flush. Check its name, value, unit, and resource identity.
7. If cross-service tracing is promised, send a known valid incoming W3C context and make an outgoing call to a controlled endpoint. Check trace continuity, parent IDs, and outgoing propagation. Do not send trace context or ingestion credentials to arbitrary hosts.
8. End the operation, shut down gracefully, and inspect final export errors or partial-success responses. Verify that the process still exits as before.

For generic OTel setups, a local Collector with a detailed debug exporter can decode the real OTLP requests. Bind it to loopback, enable HTTP only, and inspect the native fields. No production DSN is needed for a local receiver. A console exporter alone proves creation, not OTLP transport. A local receiver does not test Monocle authorization or storage.

Use the [upstream Collector example](https://opentelemetry.io/docs/languages/python/exporters/#collector-setup) as a starting point, but omit its gRPC receiver. Do not expose a debug receiver publicly or print real telemetry into a review artifact.

## Check the destination

With authorization to send test data, use the intended DSN and the `development` environment unless the user specifies another safe target. Do not silently redirect an application away from its configured destination.

1. Send a synthetic operation with a unique nonpersonal marker attribute.
2. Wait for batching and ingestion. Search a bounded time window in the correct project, environment, and service.
3. Locate the trace and inspect its actual attributes. Locate a correlated log and an exported metric when enabled. Locate the expected issue for the failure fixture.
4. Confirm that the recovered child failure did not create an issue and that one failure was not captured twice.

Use available read-only Monocle MCP tools after discovering their schemas, or inspect the Monocle UI. Tool names from Maple, including `audit_setup`, are not assumed to exist in Monocle.

No cloud access means **cloud unverified**, not success. A successful fallback curl from `setup_service` proves access to ingestion, not that the application's instrumentation works. `Last used` proves credential use, not retention. Even HTTP 2xx can accompany discarded data when the telemetry budget is exhausted.

## Check lifecycle where relevant

For changes to bootstrap, shutdown, or logger integration, also test the likely regression:

- Repeated initialization or reload must not double the number of emitted records.
- Concurrent requests must not share trace or user context.
- An unavailable exporter must not break application requests or cause unbounded shutdown waits.
- Exporter diagnostics must not create an export feedback loop.

Keep durable tests for user-visible behavior when the project has a suitable test location. Remove temporary smoke code, capture fixtures, and debug logging after the run.

## Report the evidence

Use one status per service:

| Status | Required evidence |
| --- | --- |
| Cloud verified | Actual application emission and matching stored records in Monocle for each claimed signal |
| Local export verified | Actual application OTLP decoded by a local receiver, with cloud checks explicitly pending |
| Not verified | Only configuration, startup, console output, access checks, or incomplete observations |

List partially verified signals separately. State observed facts and remaining hypotheses. Do not call a missing record an exporter defect until you have checked the active code path, target environment, sampling, time window, filters, and budget.
