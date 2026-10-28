# Configure Rust applications

## Inspect the runtime and subscriber

Read `Cargo.toml`, `Cargo.lock`, the async runtime, the server entry point, and the existing `tracing` subscriber. Check whether an official Monocle integration is actually published and supports this framework before recommending it. Do not prescribe an unpublished path dependency from Monocle's private repository.

When using native OTel, keep the `opentelemetry`, `opentelemetry_sdk`, `opentelemetry-otlp`, and logging bridge releases compatible. Match `tracing-opentelemetry` to that SDK release. Resolve APIs from the installed crate documentation, not a hard-coded version table.

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

- [Rust OTel](https://opentelemetry.io/docs/languages/rust/)
- [OTLP crate and features](https://docs.rs/opentelemetry-otlp/)
- [tracing bridge](https://docs.rs/tracing-opentelemetry/)
- [logging bridge](https://docs.rs/opentelemetry-appender-tracing/)
- [Async tracing guidance](https://docs.rs/tracing/latest/tracing/span/struct.Span.html#in-asynchronous-code)
- [Monocle semantic conventions](https://monocle.sh/docs/opentelemetry/semantic-conventions)
