# Configure Node.js with OpenTelemetry

Monocle publishes Node.js agents for AdonisJS and Effect only. For NestJS, Express, Fastify, and other frameworks, use the official `@opentelemetry/*` packages. Keep an existing Effect integration and read its package documentation before extending it. Check npm before using any other `@monocle.sh/*` package name.

## Set up the SDK

1. Use the project's package manager, loader, and pinning style. Pick mutually compatible API, SDK, exporter, and instrumentation versions. Stable and experimental packages have different version numbers.
2. Configure one `NodeSDK` with OTLP HTTP exporters for traces, logs, and metrics. `*-otlp-proto` sends protobuf and `*-otlp-http` sends JSON. Monocle accepts both, not gRPC. Apply [connection.md](connection.md) to every exporter.
3. Enable instrumentation for the libraries the application uses, within their supported version ranges. For `@opentelemetry/instrumentation-pg`, set `ignoreConnectSpans: true`, or Monocle lists connection spans as queries.
4. Load telemetry before the application, for example `node --import ./telemetry.js <entrypoint>`. ESM instrumentation may need the OpenTelemetry module hook.
5. Await `sdk.shutdown()` after requests stop, in the existing lifecycle handler. In an `uncaughtException` hook, emit the reporter log, await `sdk.shutdown()` with a timeout of a few seconds, then exit with code 1. A flush that is not awaited loses the report.

Read the installed declarations for constructor options. Releases differ on `metricReader`, `metricReaders`, and `BatchLogRecordProcessor` arguments.

## Attribute users

Monocle reads `user.id`, `user.email`, and `user.name` from the request's SERVER span, not from a child span. With `@opentelemetry/instrumentation-http`, set them in `applyCustomAttributesOnSpan`. The hook runs when the response ends and receives the incoming request, so read the user that authentication attached to it, such as `request.user` in NestJS on Express. Fastify keeps its request object apart from `request.raw`: check which one the hook receives.

## Report errors

Framework error boundaries run inside a child span, so an exception recorded there opens no issue. Report each unexpected 5xx failure once from the existing boundary, such as a NestJS filter that extends `BaseExceptionFilter` and calls `super.catch`, or Express error middleware. Emit the exception reporter log described in [signals.md](signals.md), in the active context, with the user attributes when available. Keep the framework's response. Do not report expected 4xx errors.

Get the logger from the API package that the installed `NodeSDK` registers with. With `@opentelemetry/sdk-node` 0.301 and `@opentelemetry/api` 1.10, use `logs` from `@opentelemetry/api`. A logger from `@opentelemetry/api-logs` reads a separate global and drops logs silently.

This reporter log carries no `monocle.exception.debug_ids`, and Monocle resolves JavaScript frames only through debug IDs. Upload the server maps anyway, and report server frame resolution as unavailable.

## Keep logs

Use the existing logger's OpenTelemetry instrumentation and an OTLP log exporter. `NodeSDK` does not forward `console.*`. Keep console, file, and remote destinations.

## Sources

- [OpenTelemetry Node.js](https://opentelemetry.io/docs/languages/js/getting-started/nodejs/)
- [OpenTelemetry JavaScript exporters](https://opentelemetry.io/docs/languages/js/exporters/)
- [HTTP instrumentation options](https://github.com/open-telemetry/opentelemetry-js/tree/main/experimental/packages/opentelemetry-instrumentation-http)
