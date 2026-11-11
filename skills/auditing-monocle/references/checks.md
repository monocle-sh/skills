# Monocle audit checks

Check IDs are stable. Severity follows observed impact and agreed coverage. Disabled optional features are not failures. Distinguish evidence from hypotheses.

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

DSN authentication supplies canonical `service.name`. A missing local name alone is not a routing defect. New connections use service IDs. Legacy name-based routing remains compatible.

Service DSNs are ingestion-only and may be browser-approved. They do not replace private project tokens or legacy full-access keys. Prefixes do not prove scope. No test token exists. A `401` is generic. Connection caching can delay recovery for five minutes.

## Trace classification and context

| ID | Check | Impact when broken |
| --- | --- | --- |
| HTTP-01 | Incoming requests use kind `SERVER` and `http.request.method`, with final response status and a stable matched `http.route` when available. AdonisJS telemetry middleware runs first in the router stack, before body parsing and authentication. | Requests are absent, misclassified, or grouped by individual paths. Early rejections can miss route enrichment. |
| HTTP-02 | Outgoing calls use kind `CLIENT`, `http.request.method`, and a real `server.address` where available. | External calls are absent or attribution is degraded. |
| DB-01 | Database calls use kind `CLIENT` and `db.system.name`. Query text is parameterized and the driver instrumentation actually executes. | Queries are absent or expose values. Redis is not listed in Queries. |
| CTX-01 | W3C trace context is extracted, active during async work, and injected into intended downstream calls. Native parent IDs match. | Distributed traces fragment. |
| CTX-02 | Async and concurrent work keeps its own active span and approved user identity. Background work has an intentional parent or link. | Cross-request attribution or missing context. |
| CTX-03 | Exported OTLP flags describe remote parents when supported. Server and consumer kinds remain correct when flags are unavailable. | Service segments and related context can be wrong. A client attribute cannot replace flags. |
| JOB-01 | Jobs carry `messaging.system`, `messaging.operation.type`, and a stable `messaging.job.name` where possible. Execution links to dispatch context. | Jobs are missing, misclassified, or disconnected. |
| CLI-01 | Command entries carry `entry_point.type=cli` and `cli.command.name`, and flush before exit. | Commands are missing or final records are lost. |

Jobs use `send` or `create` for dispatch and `process` for execution. Optional fields include queue name, message ID, retry count, and measured `messaging.job.queue_time_ms`. Unknown values remain absent.

Ingestion normalizes known legacy HTTP and DB keys. Accepted legacy names alone do not prove broken features.

## Exceptions and logs

| ID | Check | Impact when broken |
| --- | --- | --- |
| ERR-01 | An unhandled failure produces exception details with nonempty `exception.type`, using a supported reporting path. Status is a native SDK field, not a string attribute. | Errors may lack details or never become issues. |
| ERR-02 | Entry failures and recovered child exceptions are distinguished. Explicit reporter logs are deliberate, not added to every error log. | Missing issues or false issues for recovered work. |
| ERR-03 | One failure is not emitted as both a reportable entry event and a reporter log without verified deduplication. `should_report=false` is honored. | Duplicate or unwanted issue occurrences. |
| LOG-01 | Required application logs reach OTLP through the actual logger bridge. Existing sinks and redaction remain intact. Stdout or exception-reporter logs alone do not pass. | Required logs remain local or existing safeguards break. |
| LOG-02 | In-span logs retain native trace and span IDs, body, severity, and useful structured fields. Custom filtering has a demonstrated need and preserves unrelated diagnostics. | Correlation or diagnostics are lost. |
| USR-01 | Authenticated error coverage includes the stable internal ID, email, and name when available and permitted. Auth resolution precedes explicit attribution; reload, logout, account changes, anonymous requests, and concurrent requests do not retain the wrong identity. Browser attribution follows existing auth state. Analytics-only scope adds no identity hook. | Missing user attribution, identity leakage, or collection outside scope. |

General server onboarding requires application log export unless excluded. Disabling its bridge leaves a coverage gap. A privacy blocker needs an actual sensitive field and inadequate native controls, not a hypothetical payload. Correlation IDs such as `x-request-id`, business identifiers, and standard `err` details are not inherently forbidden. Field names alone justify neither deletion nor custom processors. Preserve SDK defaults and redact only identified sensitive values.

An event named `exception` on a failed entry is reportable. Server and consumer spans qualify as entries, as do spans without a local parent except client and producer spans. Failure is `ERROR` or HTTP status of at least 500. An exception on a recovered child remains visible in the trace without opening an issue.

Explicit reporting uses `exception.type` and `monocle.log.source=exception_reporter`. `monocle.exception.should_report=false` excludes it. Plain `ERROR` logs do not meet this contract. An ordinary logger record beside an SDK exception report does not alone prove duplicate issues. The collector owns fingerprints and receipt IDs.

## Versions, metrics, and feature coverage

| ID | Check | Impact when broken |
| --- | --- | --- |
| VER-01 | Entry spans have a real `service.version` when deployment detection is expected. A semver release can carry `vcs.ref.head.revision` and repository URL. | Missing deployment detection or source links. |
| MET-01 | Claimed metrics have actual instruments, measurements, collection, and an OTLP exporter. Instance displays have `service.instance.id`. | Missing metrics or instances. |
| MET-02 | Names, units, temporality support, and dashboard expectations match the selected instruments. Labels and span names have bounded cardinality. | Misleading values, excessive series, or absent specialized widgets. |
| OPT-01 | Enabled cache, AI, MCP, user, and business instrumentation follows the real Monocle attributes, without duplicating upstream instrumentation. | The enabled feature is degraded or data volume is inflated. |
| WEB-01 | Browser collectors match agreed coverage. If error coverage was selected, it remains enabled when an integration list replaces SDK defaults. Analytics-only setup does not add backend instrumentation or remove existing backend coverage. Selected network capture propagates context only to intended APIs. | Missing promised errors or traces, or unselected collection. |
| WEB-02 | Selected analytics emits expected page views without duplicate router hooks or personal data. | Inflated counts or sensitive event properties. |
| MAP-01 | Compiled JavaScript error coverage includes source-map preparation unless explicitly excluded. Every relevant output has a matching build and debug-ID upload path, private tokens, and no publicly deployed maps. Configuration, upload, and original-frame resolution have separate verification evidence. | Minified errors remain unresolved, source code becomes public, or verification is overstated. |
| PRIV-01 | Credentials and disallowed personal data are excluded before export using targeted native controls. Findings cite concrete content paths, not field names alone. | Sensitive data exposure or needless loss of diagnostics. |
| PRIV-02 | Arbitrary body or header capture, cookies, AI content, other profile fields, and extra console capture require approval. Existing correlation metadata is distinct from bulk header capture. Default error attribution includes available ID, email, and name, and respects exclusions. Selected content capture is bounded and tested. | Collection exceeds agreed coverage or changes application behavior. |
| PRIV-03 | Selected replay waits for visitor consent, stops capture on withdrawal, and masks or blocks sensitive content. Replay identity has separate approval. | Page content is recorded outside the agreed capture policy. |

Ignored version placeholders include `0.0.0`, `0.0.1`, `1.0.0`, `unknown`, `dev`, and `latest`. A first observation is a baseline. Logs alone do not drive deployment detection.

CI and Docker are not prerequisites. Check existing publication scripts and supported version detection. Report missing metadata, token, upload, deployed build, and original frame separately, with next steps. Source maps match debug IDs, not deployment declarations. Detected deployments reflect version observations, not exact completion times.

Vendor coexistence depends on per-feature decisions, provider ownership, patches, and emissions. Installed packages alone do not establish a conflict. Untested coexistence remains unverified.

System Metrics reads selected process, V8, and Node.js metrics. Other retained metrics appear in the Metrics explorer. Collector filters discard some names. Go, Rust, and Python metrics do not populate Node.js widgets.

Optional attributes include `cache.operation`, `cache.hit`, `cache.store`, `gen_ai.operation.name`, model and token counts, and `mcp.method.name`. User attribution reads `user.id`, `user.email`, and `user.name`, not `enduser.id`. Monocle computes supported AI cost from models and token counts, not Maple conventions. The email dashboard requires `email.system=adonisjs-mail`. Other libraries must not impersonate it.

## Sources

- [Connection contract](https://monocle.sh/docs/opentelemetry/any-sdk)
- [Semantic conventions](https://monocle.sh/docs/opentelemetry/semantic-conventions)
- [Browser integrations and replay consent](https://monocle.sh/docs/sdks/browser)
- [Source-map setup and verification](https://monocle.sh/docs/sdks/source-maps)
- [Deployment detection](https://monocle.sh/docs/features/deployments)
- [Troubleshooting](https://monocle.sh/docs/troubleshooting)
