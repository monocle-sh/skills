# Signals consumed by Monocle

This reference describes the attributes that power Monocle features. A required attribute is required for the named feature, not for every span. Optional features remain optional even when their attributes are documented here.

## Resources

| Attribute | Meaning |
| --- | --- |
| `service.name` | Canonical service identity is supplied by DSN authentication. A local name remains useful for other exporters. |
| `service.version` | Real release or deployed revision. Entry spans feed deployment detection. |
| `vcs.ref.head.revision` | Commit SHA, especially when the release is a semver tag. |
| `vcs.repository.url.full` | Canonical HTTPS repository URL for source links. |
| `deployment.id` | Platform deployment identifier when available. |
| `service.instance.id` | Per-instance identity needed for System Metrics instances. |
| `host.name` | Host display metadata when appropriate. |

Monocle ignores placeholder versions `0.0.0`, `0.0.1`, `1.0.0`, `unknown`, `dev`, and `latest`. Official SDK version detection takes precedence over adding new application version plumbing. With generic OTel, use an existing release or build revision. Do not invent one or run `git` in a production request path.

The environment comes from `x-monocle-env`, not a resource attribute. The first observed version is a deployment baseline, not a newly detected deployment. Logs alone do not drive detected deployments.

## HTTP requests

| Field or attribute | Requirement |
| --- | --- |
| Span kind `SERVER` | Required |
| `http.request.method` | Required |
| `http.route` | Recommended route template, such as `/orders/{id}`, for endpoint grouping |
| `url.path` | Fallback path when no route is available |
| `http.response.status_code` | Response breakdown and error rates |
| `http.connection_type` | `sse` or `websocket` for long-lived connections when known |

A request span covers the actual request lifetime, including async handling. A 5xx response is a server failure. An expected 4xx response is not automatically an unhandled server exception. Span names and routes must not contain per-user or per-order identifiers. URLs must exclude credentials and sensitive query values.

HTTP body capture is optional. `monocle.http.request.body` and `monocle.http.response.body` power the body view, but are not part of default onboarding.

## Outgoing HTTP and distributed traces

Outgoing calls use `CLIENT`, `http.request.method`, and preferably `server.address`. `url.template` identifies a stable URL pattern. `url.full` and `http.response.status_code` add context when safely collected.

W3C `traceparent` and `tracestate` preserve the caller's trace and parent IDs. Trace headers go only to intended downstream hosts. Browser propagation requires a restricted host allowlist and API CORS support for the propagated headers. Ingestion headers must never be attached to application HTTP calls.

OTLP span flags describe whether a parent is remote. Monocle uses them for service segments. Without them, server and consumer kinds provide a fallback. Client and producer spans do not start service segments. Setting a custom `monocle.parent.remote` attribute does not substitute for correct OTLP flags.

## Database queries

Queries need `CLIENT` and `db.system.name`. Recommended attributes are `db.operation.name`, `db.namespace`, `db.collection.name`, and `db.query.text`. Parameterized SQL is preferred. Raw bind values and connection credentials are not needed.

An `INTERNAL` span with SQL text does not qualify as a database client span. Redis commands are not listed in Queries.

## Jobs and commands

Jobs need `messaging.system` and `messaging.operation.type`. Dispatches use `send` or `create`. Executions use `process`. `PRODUCER` and `CONSUMER` express the corresponding boundaries.

| Attribute | Meaning |
| --- | --- |
| `messaging.job.name` | Stable job type for grouping |
| `messaging.destination.name` | Queue name |
| `messaging.message.id` | Individual job identifier |
| `messaging.message.retry.count` | Actual retry count |
| `messaging.job.queue_time_ms` | Actual queue wait in milliseconds, when known |

Monocle's job view uses a span link from execution to dispatch to connect their traces. Preserve existing messaging propagation and add the link where the framework exposes the dispatch context. Do not pretend that a made-up queue time or a span name supplies missing context.

A CLI execution uses an entry span with `entry_point.type=cli` and `cli.command.name`. `cli.command.description` is optional. `cli.args.*` and `cli.flags.*` are not collected by default because command arguments may contain secrets.

## Exceptions and logs

A span event named `exception` carries `exception.type`, with `exception.message` and `exception.stacktrace` when available. Setting span status to `ERROR` alone does not provide exception details.

A span exception is reportable when the span is an entry that failed. Entries are server or consumer spans, or spans without a local parent, excluding client and producer spans. Failure means `ERROR` status or HTTP status of at least 500. Exceptions on other spans stay in the trace without opening issues.

An explicit capture outside that path can use an OTLP log with `exception.type`, message and stack, and `monocle.log.source=exception_reporter`. It is a deliberate issue-reporting path, not a label for every error log. `monocle.exception.should_report=false` excludes reporting. Do not emit both a reportable entry event and a reporter log for one failure without a verified SDK deduplication mechanism.

`monocle.exception.frames`, `monocle.exception.cause_chain`, and `monocle.exception.values` are structured enrichment formats. They are not required for basic exception capture. Their serialization must follow the current official SDK contract. Do not invent their JSON shape. Fingerprints, occurrence IDs, and receipt IDs are collector responsibilities.

OTLP logs carry their body, severity, attributes, and native trace and span ID fields. Putting IDs only in the message or string attributes does not establish native correlation. The existing logger's console and file sinks remain intact. Exporter diagnostics must not feed back into the same OTLP log bridge.

## Optional enrichment

| Feature | Attributes and limits |
| --- | --- |
| User attribution | `user.id` on request spans or explicit reports after consent. Use an opaque ID. `user.email` and `user.name` are optional personal data, not defaults. `enduser.id` is not read. Clear identity on logout and isolate request context. |
| Business operations | Active spans around selected operations with real latency or failure modes. Stable names such as `order.process`. Opaque entity identifiers only after approval. |
| Cache | `cache.operation` identifies the operation. `cache.hit` describes hits, `cache.store` the store, and optional `cache.key` the key. Keys may contain sensitive data and are not needed by default. |
| Email | The current email dashboard expects `CLIENT`, `email.system=adonisjs-mail`, and `email.operation=send`. Do not label another mail library as AdonisJS to make it appear. Subject and recipient attributes are not default collection. |
| AI | `gen_ai.operation.name` classifies operations. Model names and actual `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, and `gen_ai.usage.input_tokens.cached` support usage and cost. Monocle computes cost from supported models and tokens. No Maple-specific cost or session attributes are needed. |
| AI tools and conversations | `gen_ai.tool.name` and optional opaque `gen_ai.conversation.id`. Inputs, outputs, tool arguments, and conversation content remain off by default. |
| AI evaluations | Events named `gen_ai.evaluation.result` with `gen_ai.evaluation.name` and `gen_ai.evaluation.score.value` describe actual evaluations, not generated scores. |
| MCP | `mcp.method.name` classifies calls. Optional `mcp.tool.name`, `mcp.client.name`, `mcp.client.version`, and `mcp.tool.result.is_error` add context. |
| Captured messages | `monocle.message.level` represents captured-message level. `monocle.tag.*` and `monocle.extra.*` carry approved extra data, not unfiltered objects. |

Compatible instrumentation owns existing spans. Enrichment does not mean wrapping an already instrumented provider call in a second identical span.

## Metrics

Metrics need real instruments, measurements, and an OTLP metric exporter. Trace export alone does not provide metrics. Counters and histograms are created once in their owning scope, with bounded dimensions such as operation and outcome. IDs, raw URLs, and unbounded tenant labels are not metric dimensions.

System Metrics reads `process.cpu.utilization` with `process.cpu.state`, `process.memory.usage`, `v8js.memory.heap.used`, `v8js.memory.heap.limit`, `nodejs.eventloop.utilization`, and `nodejs.eventloop.delay.p99`. Other retained metrics belong in the Metrics explorer. A Go, Python, or Rust runtime metric is not automatically a Node.js dashboard metric. Some collector filters discard metric names, so acceptance alone does not prove that a metric is retained.

## Compatibility

Monocle normalizes known legacy keys, including `http.method`, `http.status_code`, `http.target`, `http.url`, `net.peer.name`, `net.peer.port`, `db.system`, `db.operation`, `db.statement`, `db.sql.table`, and `db.name`. Stable names take precedence when both are present. Old names alone are not proof of broken ingestion. New code uses the current names listed here.

Authenticated `monocle.organization_id`, `monocle.application_id`, environment, service identity, grouping, and receipt metadata are not application configuration fields.

## Sources

- [Semantic conventions](https://monocle.sh/docs/opentelemetry/semantic-conventions)
- [Deployments](https://monocle.sh/docs/features/deployments)
- [Jobs](https://monocle.sh/docs/features/jobs)
- [OpenTelemetry semantic conventions](https://opentelemetry.io/docs/specs/semconv/)
