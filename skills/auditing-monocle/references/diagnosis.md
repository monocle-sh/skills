# Diagnose a specific telemetry problem

Keep the investigation tied to the reported symptom. Use [check IDs](checks.md) in findings. Do not change code or send test telemetry during a read-only audit.

## Establish the observation

Record the affected service, project, environment, signal, time window, and expected operation. Identify the deployed version separately from the local checkout. Establish whether the operation actually ran and whether sampling should retain it.

Use a representative trace or a synthetic marker when available. Do not ask the user to paste credentials, customer logs, bodies, or prompts. Inspect safe configuration locations and bounded metadata instead.

## Follow the signal through the system

1. Find the real entry point and telemetry bootstrap used by that deployment.
2. Confirm that the affected operation crosses a registered instrumentation hook or explicit span boundary.
3. Inspect the emitted kind, attributes, IDs, timestamps, and resource metadata. If a local run is authorized, decode actual OTLP rather than relying only on console output.
4. Check exporter protocol, endpoint paths, the presence of required headers without exposing their values, shutdown errors, and OTLP partial success.
5. Check the correct Monocle destination, filters, sampling, budget state when visible, batching delay, and time window.
6. Check whether the stored record satisfies the affected dashboard's classification contract.

Stop when evidence establishes the cause. If a stage cannot be observed, name that missing evidence and keep the diagnosis conditional.

## Common symptoms

| Symptom | Distinguishing checks |
| --- | --- |
| Nothing arrives | Loaded bootstrap, actual traffic, exporter creation, HTTP transport, service and environment headers, authorization, queue flush, and destination. AdonisJS development may intentionally use Studio. |
| HTTP spans exist but Requests is empty | Native `SERVER` kind and `http.request.method`. A span name containing `GET` is insufficient. |
| Queries are missing | Actual driver hook, native `CLIENT` kind, and `db.system.name`. Check whether only Redis calls were expected, since they are not listed in Queries. |
| Logs cannot open their trace | Native OTLP trace and span IDs, active context at emission, and actual bridge rather than correlation-only stdout formatting. |
| An exception does not open an issue | Event name and `exception.type`, failed entry versus recovered child, `should_report`, or explicit reporter-log source. |
| One error appears twice | Duplicate providers, multiple framework handlers, reportable span event plus reporter log, or repeated manual capture. Do not assume retries explain it. |
| Cross-service traces fragment | Outgoing client span, injected W3C context, downstream extraction, parent IDs, and sampling. Merely grouping services in one project does not join traces. |
| User context belongs to another request | Global identity state, async context handling, concurrent requests, and logout reset. Inspect metadata without exposing identities. |
| Deployments are missing | Real version on entry spans, placeholder filtering, first baseline, traffic, and deployed revision. Do not expect a new deployment from every observed log. |
| Runtime widget is empty | Actual emitted metric names, instance ID, collector filtering, and supported widget names. Check Metrics explorer before inventing replacement measurements. |
| Export succeeds but data is absent | OTLP partial success, wrong destination, time window, sampling, clock skew, batching, budget discard, and metric filters. HTTP 2xx is not proof of retention. |
| A fixed connection still fails | Recheck the real deployed configuration and allow for cached authorization decisions of up to five minutes. Do not try unrelated ingest hosts or rotate keys automatically. |

## Validate a proposed fix

For an authorized local fix, rerun the same scenario that demonstrated the defect. Keep a control where a plausible wrong fix would differ, such as a recovered child error, two parameter values on one route, or two concurrent requests.

Report application startup, actual decoded export, and cloud observations separately. Cloud verification needs matching records in the intended service and environment. Existing `Last used` timestamps or a successful fallback curl do not validate application instrumentation.

If only source code changed, say that deployment and live verification remain pending. Remove temporary probes after testing. Never fix a symptom by enabling every optional capture setting.
