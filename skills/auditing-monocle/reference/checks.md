# Monocle audit checks

Check IDs identify stable diagnostic questions. Impact determines severity. An optional feature deliberately left off is not a failure. Every finding needs evidence and must distinguish confirmed defects from hypotheses.

## Connection and lifecycle

| ID | Check | Impact when broken |
| --- | --- | --- |
| CON-01 | The runtime creates and uses the intended provider before instrumented code loads. The deployed start command includes the bootstrap. | Required work emits no spans or only partial spans. |
| CON-02 | Every enabled signal uses OTLP HTTP protobuf or JSON and the correct signal URL. Monocle has no gRPC endpoint. | Exports fail or go to the wrong receiver. |
| CON-03 | Export requests carry `x-api-key`, `x-monocle-service-id`, and `x-monocle-env`. The DSN is translated into an origin and headers, not used directly as an export URL. | Connection rejection or wrong destination. |
| CON-04 | The selected service, project, and environment match the intended destination. Routing is not inferred from `deployment.environment.name` or an arbitrary resource name. | Data appears elsewhere or authentication fails. |
| CON-05 | Authenticated storage is checked separately from HTTP acceptance. Time window, sampling, budget, filters, and partial success are accounted for. | A false success claim or incorrect diagnosis. |
| LIFE-01 | Initialization happens once per process or worker. Existing providers are extended rather than replaced. | Duplicate exports, broken coexistence, or inconsistent context. |
| LIFE-02 | Batch exporters flush after work stops with bounded deadlines. Shutdown preserves exit status and existing handlers. | Last records are lost or application behavior changes. |
| LIFE-03 | Exporter diagnostics do not enter their own OTLP log bridge. Queues and retries are bounded. | Feedback loops, excess volume, memory growth, or stalled shutdown. |

For DSN connections, Monocle supplies the canonical `service.name`. A missing explicit local name alone is not a critical routing defect. New connections use service IDs. Legacy name-based routing is compatible behavior, not a reason to break an existing installation.

Current service DSNs are ingestion-only and may be browser-approved. Legacy full-access keys and project tokens are not interchangeable with them. A prefix does not prove key scope. No magic test token is defined. A `401` is generic and cached connection decisions can delay recovery for up to five minutes.

## Trace classification and context

| ID | Check | Impact when broken |
| --- | --- | --- |
| HTTP-01 | Incoming requests use kind `SERVER` and `http.request.method`, with final response status and a stable matched `http.route` when available. | Requests are absent, misclassified, or grouped by individual paths. |
| HTTP-02 | Outgoing calls use kind `CLIENT`, `http.request.method`, and a real `server.address` where available. | External calls are absent or attribution is degraded. |
| DB-01 | Database calls use kind `CLIENT` and `db.system.name`. Query text is parameterized and the driver instrumentation actually executes. | Queries are absent or expose values. Redis is not listed in Queries. |
| CTX-01 | W3C trace context is extracted, active during async work, and injected into intended downstream calls. Native parent IDs match. | Distributed traces fragment. |
| CTX-02 | Async and concurrent work keeps its own active span and approved user identity. Background work has an intentional parent or link. | Cross-request attribution or missing context. |
| CTX-03 | Exported OTLP flags describe remote parents when supported. Server and consumer kinds remain correct when flags are unavailable. | Service segments and related context can be wrong. A client attribute cannot replace flags. |
| JOB-01 | Jobs carry `messaging.system`, `messaging.operation.type`, and a stable `messaging.job.name` where possible. Execution links to dispatch context. | Jobs are missing, misclassified, or disconnected. |
| CLI-01 | Command entries carry `entry_point.type=cli` and `cli.command.name`, and flush before exit. | Commands are missing or final records are lost. |

Jobs use `send` or `create` for dispatch and `process` for execution. Optional fields include queue name, message ID, retry count, and measured `messaging.job.queue_time_ms`. Unknown values are omitted rather than fabricated.

Known legacy HTTP and DB keys are normalized on ingestion. An accepted legacy name is a maintenance observation, not proof of a broken dashboard. Consult current conventions before proposing a rename.

## Exceptions and logs

| ID | Check | Impact when broken |
| --- | --- | --- |
| ERR-01 | An unhandled failure produces exception details with nonempty `exception.type`, using a supported reporting path. Status is a native SDK field, not a string attribute. | Errors may lack details or never become issues. |
| ERR-02 | Entry failures and recovered child exceptions are distinguished. Explicit reporter logs are deliberate, not added to every error log. | Missing issues or false issues for recovered work. |
| ERR-03 | One failure is not emitted as both a reportable entry event and a reporter log without verified deduplication. `should_report=false` is honored. | Duplicate or unwanted issue occurrences. |
| LOG-01 | The application's actual logger reaches an OTLP log exporter through a bridge. Existing sinks and redaction remain intact. | Logs stay local or sensitive data starts leaving the process. |
| LOG-02 | In-span OTLP logs have native trace and span ID fields. Body, severity, and structured attributes are preserved. | Log-to-trace correlation and filtering are degraded. |

An event named `exception` on a failed entry is reportable. Server and consumer spans qualify as entries, as do spans without a local parent except client and producer spans. Failure is `ERROR` or HTTP status of at least 500. An exception on a recovered child remains visible in the trace without opening an issue.

Explicit out-of-span reporting uses a log with `exception.type` and `monocle.log.source=exception_reporter`. `monocle.exception.should_report=false` excludes it. A plain `ERROR` log is not that contract. Fingerprints and receipt IDs are collector responsibilities.

## Versions, metrics, and optional features

| ID | Check | Impact when broken |
| --- | --- | --- |
| VER-01 | Entry spans have a real `service.version` when deployment detection is expected. A semver release can carry `vcs.ref.head.revision` and repository URL. | Missing deployment detection or source links. |
| MET-01 | Claimed metrics have actual instruments, measurements, collection, and an OTLP exporter. Instance displays have `service.instance.id`. | Missing metrics or instances. |
| MET-02 | Names, units, temporality support, and dashboard expectations match the selected instruments. Labels and span names have bounded cardinality. | Misleading values, excessive series, or absent specialized widgets. |
| OPT-01 | Enabled cache, AI, MCP, user, and business instrumentation follows the real Monocle attributes, without duplicating upstream instrumentation. | The enabled feature is degraded or data volume is inflated. |
| PRIV-01 | Secrets and unapproved personal data are excluded before export. URL queries, SQL binds, arguments, and error messages are checked, not just bodies. | Sensitive data exposure. |
| PRIV-02 | Bodies, headers, cookies, AI content, user attribution, and extra console collection are off unless approved. Capture policies are bounded and tested. | Collection exceeds user consent or changes application behavior. |

Ignored version placeholders include `0.0.0`, `0.0.1`, `1.0.0`, `unknown`, `dev`, and `latest`. A first observation is a baseline. Logs alone do not drive deployment detection.

System Metrics reads selected process, V8, and Node.js metrics. Other retained metrics can appear in the Metrics explorer. Some metric names are discarded by collector filters. Do not expect Go, Rust, or Python metrics to fill Node.js widgets.

Optional attribute examples are `cache.operation`, `cache.hit`, `cache.store`, `gen_ai.operation.name`, model and token counts, `mcp.method.name`, and approved `user.id`. `enduser.id` is not read for user attribution. Monocle computes supported AI cost from models and token counts; Maple-specific pricing or session conventions do not apply. The current email dashboard is specific to `email.system=adonisjs-mail`. Do not impersonate another integration.

## Sources

- [Connection contract](https://monocle.sh/docs/opentelemetry/any-sdk)
- [Semantic conventions](https://monocle.sh/docs/opentelemetry/semantic-conventions)
- [Deployment detection](https://monocle.sh/docs/features/deployments)
- [Troubleshooting](https://monocle.sh/docs/troubleshooting)
