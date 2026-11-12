# Configure Rust applications

## Inspect the runtime and subscriber

Read `Cargo.toml`, `Cargo.lock`, the async runtime, the server entry point, and the existing `tracing` subscriber.

## Use the Monocle SDK

The `monocle-sh-sdk` crate exposes `monocle` in Rust code. It sends `tracing` spans, logs, and metrics, and reports errors and panics. Its `axum` feature adds a server layer. Follow the [Rust guide](https://monocle.sh/docs/sdks/rust) and the installed crate documentation:

- Call `monocle::init` once at startup, add `monocle.layer()` to the existing subscriber, and call `monocle::install_panic_hook()`. Keep the client until the server stops, then call `shutdown()`.
- Read `MONOCLE_ENVIRONMENT` and `MONOCLE_VERSION` from the process environment. Do not default the environment to `development`, because a production process that misses the variable would report as development.
- `init` requires a DSN and has no Studio mode. When `MONOCLE_DSN` is absent, keep the existing subscriber, log one line that says Monocle is off, and report local export as blocked.
- Add `monocle::axum::layer()` after the routes. It creates the SERVER span with the route template, continues `traceparent`, and marks 5xx responses as failed.
- Call `monocle::capture_error` once in the existing error-to-response conversion for unexpected 5xx errors. `tracing::error!` alone stays a log and opens no issue.
- Use `monocle-sh-sdk` 0.1.1 or later for user attribution. In the authentication extractor or middleware, after the user resolves, call `monocle::set_user(monocle::User { id, email, name })` with the existing ID, email, and name. It sets `user.id`, `user.email`, and `user.name` on the request span, and exceptions that `capture_error` or the panic hook report later in the same request carry the same user. Concurrent requests keep their own user. Outside a request span it does nothing, so call it inside the request.
- Database calls need their own instrumentation. sqlx emits no OTel CLIENT spans. Instrument the existing query functions with `tracing::Instrument` and a span that sets `otel.kind = "client"`, `db.system.name`, `db.operation.name`, `db.collection.name`, and the parameterized `db.query.text`. Never record bind values. When a query fails, record `otel.status_code = "ERROR"` on its span, or the Queries view counts no error. If queries have no shared call site, report database coverage as partial instead of wrapping every call.

Rust issues show raw frames until the build's debug file is uploaded. For Linux x86_64 ELF/DWARF builds, follow [native symbols](https://monocle.sh/docs/sdks/native-symbols):

- Keep `debug = 1` and `strip = false` in the release profile, so the build keeps functions, files, and lines.
- After the final build, run `npx @monocle.sh/cli debug-files upload <binary>` with `MONOCLE_API_KEY` from the CI secrets. The CLI 0.6 or later needs Node.js 22.12 or later. Pass the commit with `--release` when the pipeline has one.
- `--include-sources` uploads checkout files for code excerpts. Add it only with source-upload authorization. `debug-files check` lists the files first.
- Strip the binary after the upload and deploy that binary. A rebuild produces a new build ID.
- In a Docker build, export the unstripped binary from a dedicated stage and upload it from the CI checkout. Never pass the token to the build stage.

Without a publication workflow, give the build and upload commands in the report and the recap. Report frame resolution as unavailable until an upload succeeds. Other targets keep raw frames.

## Use native OTel

Use native OTel when the SDK does not support the framework or runtime. Keep the `opentelemetry`, `opentelemetry_sdk`, `opentelemetry-otlp`, and logging bridge releases compatible. Match `tracing-opentelemetry` to that SDK release. Resolve APIs from the installed crate documentation, not a hard-coded version table.

## Configure exports and layers

1. Enable OTLP HTTP protobuf features for the required signals. Select an HTTP client with HTTPS support. Do not select gRPC or disable certificate verification.
2. Build span, log, and metric exporters with [the connection settings](connection.md). Explicit signal endpoints end in `/v1/traces`, `/v1/logs`, and `/v1/metrics`.
3. Select exporter clients that work in the batch processor's execution context. For SDK batch processors that export on their own threads, use the compatible blocking client. An async client requiring a Tokio reactor cannot be assumed to work there. Check the selected SDK's batch processor and feature documentation.
4. Build providers with a shared resource containing [release and instance metadata](signals.md). Retain them for process lifetime and install the required global providers only once.
5. Add `tracing-opentelemetry` to the existing subscriber for spans. Use `opentelemetry-appender-tracing` for OTLP logs if the application logs through `tracing`. Preserve the existing formatting layer, filters, and destinations.
6. Exclude exporter and transport diagnostics from the OTLP log bridge. Ensure one `tracing` error event does not become both a reportable span event and an explicit reporter log.
7. Install W3C trace-context propagation and keep providers alive until the server and workers stop. Flush and shut down all enabled signals through the installed SDK API. Follow its runtime requirements and keep blocking cleanup off latency-sensitive async tasks.

Some layers translate `error` events into span exception events automatically. Inspect their defaults before adding another exception hook. Plain formatted error text is not enough to establish the `exception.type` contract.

## Configure the HTTP framework

Use maintained instrumentation compatible with the actual framework. For Axum and Tower, an ordinary `tower_http::trace::TraceLayer` does not, by itself, prove OTel server kind, incoming W3C extraction, or an OTLP exporter is configured.

Verify these behaviors in the selected middleware:

- Extract the incoming context before starting request work and set it as the server span's parent.
- Use `SERVER`, the HTTP method, the router's matched template, and the final response status.
- Keep the span active while the handler future is polled. Do not hold a `Span::enter` guard across an `await`. Use instrumentation designed for futures, such as `tracing::Instrument`.
- Define whether completion means headers or body completion. Preserve streaming and cancellation behavior. Identify known SSE and WebSocket connections without buffering them.
- Propagate the active context through supported outgoing clients without adding Monocle ingestion headers to application requests.

Set attributes using the bridge's supported OTel APIs or documented special fields. A field literally named `span.kind` is not a substitute for setting the span kind. Confirm the decoded OTLP kind.

## Preserve failure behavior

Use the existing request error handler to capture an unhandled error once. Preserve error responses and status codes. A handled `Result::Err` in an internal operation is not automatically a new issue.

If a panic hook is needed, chain the previous hook and preserve panic behavior. Do not catch panics, call `process::exit`, or claim delivery after an abort. Avoid adding a new global hook when an existing SDK already reports the same failure. Stack traces should identify their capture location rather than pretend to be the original throw site.

Use `exception.type`, message, and stack on a reportable entry event, or the explicit reporter-log path from [signals](signals.md). `tracing::error!(error = %err)` alone does not guarantee the required attributes survive the bridge.

## Verify

Follow [verification](verification.md). Check decoded server kind, route templates, incoming parent context, concurrent-request isolation, log correlation, a handled child error, and a genuine entry failure. Run the real bootstrap inside the actual async runtime.

Short-lived commands need explicit provider shutdown. Runtime metrics require actual instruments or a supported runtime integration. The `tracing` bridge does not create them automatically.

## Sources

- [Monocle Rust SDK](https://monocle.sh/docs/sdks/rust)
- [Rust OTel](https://opentelemetry.io/docs/languages/rust/)
- [Native symbols](https://monocle.sh/docs/sdks/native-symbols)
- [OTLP crate and features](https://docs.rs/opentelemetry-otlp/)
- [tracing bridge](https://docs.rs/tracing-opentelemetry/)
- [logging bridge](https://docs.rs/opentelemetry-appender-tracing/)
- [Async tracing guidance](https://docs.rs/tracing/latest/tracing/span/struct.Span.html#in-asynchronous-code)
- [Monocle semantic conventions](https://monocle.sh/docs/opentelemetry/semantic-conventions)
