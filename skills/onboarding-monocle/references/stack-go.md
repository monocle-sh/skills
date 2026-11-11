# Configure Go applications

## Inspect the existing telemetry

Read `go.mod`, `go.sum`, the server entry point, middleware, database clients, and logging setup. Reuse an existing `TracerProvider`, `MeterProvider`, propagator, and logger bridge. Do not add a second wrapper around an already traced handler.

Check upstream package documentation for the installed versions. Go's trace and metric SDKs, log SDK, and contrib instrumentation do not necessarily share the same module version. Do not force them to one version number.

## Configure the providers

1. Use native OTel modules and OTLP HTTP exporters. Trace export uses `go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp`. Metrics use `go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp`. Logs use `go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploghttp` when supported by the selected log SDK.
2. Supply [connection headers and endpoints](connection.md) through the supported OTLP environment variables or exporter options. `WithEndpoint` and `WithEndpointURL` have different shapes. Check the installed API before passing an origin or full URL. HTTPS remains enabled outside explicit local HTTP tests.
3. Build a shared resource containing [version and instance metadata](signals.md). Add an `sdktrace.TracerProvider` with a batch processor. Add an `sdkmetric.MeterProvider` with a periodic reader for enabled metrics.
4. Configure a log provider and the bridge for the actual logger, such as the compatible `otelslog` handler for `log/slog`. Preserve existing handlers and destinations. Inspect redaction first.
5. Set W3C trace-context propagation. Pass each request's `context.Context` through calls. Preserve existing approved propagators and do not add unrestricted baggage propagation.
6. Shut down the providers after work stops, using a fresh context with a bounded timeout. An already canceled request context cannot flush the final batch. Keep application shutdown errors and exit behavior intact.

Environment variables configure exporters only after code creates those exporters and providers. Setting `OTEL_*` does not instrument a Go application by itself.

## Instrument the actual libraries

For `net/http`, use compatible `otelhttp` server handlers and client transports. For Gin or another router, prefer its maintained compatible instrumentation so route templates come from the router. Verify the final `http.route`, since an outer generic HTTP wrapper may not know the matched route.

Database instrumentation depends on the driver. Inspect support for `database/sql`, pgx, or the client's own OTel hooks. Verify `CLIENT` and `db.system.name`; a timing log is not a query span. Disable bind-value capture and avoid raw SQL literals containing user data.

For queue consumers, instrument the existing dispatch and processing boundaries with actual queue context. Add the Monocle job attributes in [signals](signals.md), including an execution-to-dispatch span link where available. Do not create an entire queue instrumentation library.

Start child work with the active context. For concurrent requests, never store the active span or user in a package-global variable. For a background job that outlives a request, use the job's lifecycle and an intentional parent or link, rather than a canceled request context.

## Report errors once

`span.RecordError(err)` adds exception details but does not by itself guarantee `ERROR` span status. Set status with the SDK status API when the entry operation fails. Preserve the application's original error and response handling.

Go HTTP instrumentation cannot infer every returned application error from a response status. If needed, record the actual error in the existing error handler. Use a named application error type where available, not a fabricated type derived from the error message.

A recovered dependency error stays on its child span. Do not report it again as an unhandled error. An explicit out-of-span report uses the OTLP log contract from [signals](signals.md), not a plain `slog.Error` message.

## Verify

Follow [verification](verification.md). Run the project's targeted tests and its real server command. Exercise two different parameter values on the same route and expect the same route template. Check known incoming trace context, one client call, one enabled database call, and a controlled failure.

For enabled logs and metrics, verify actual OTLP records after shutdown or collection. Go runtime metrics are not Node.js event-loop or V8 metrics. Report the Metrics explorer as their destination unless the names match Monocle's documented System Metrics contract.

## Sources

- [Go exporters](https://opentelemetry.io/docs/languages/go/exporters/)
- [Go instrumentation](https://opentelemetry.io/docs/languages/go/instrumentation/)
- [otelhttp](https://pkg.go.dev/go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp)
- [Go logging bridges](https://opentelemetry.io/docs/languages/go/libraries/)
- [Monocle semantic conventions](https://monocle.sh/docs/opentelemetry/semantic-conventions)
