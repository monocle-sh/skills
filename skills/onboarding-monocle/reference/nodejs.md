# Configure Node.js applications

## Choose the existing SDK path first

Inspect `package.json`, the lockfile, the module format, and the real production start command. Detect framework-managed telemetry before adding a `NodeSDK`.

- For supported AdonisJS versions, use [`@monocle.sh/adonisjs-agent`](https://monocle.sh/docs/frameworks/adonisjs). Its configurator is `node ace add @monocle.sh/adonisjs-agent`. Review the generated changes and preserve existing configuration.
- For an existing official Monocle integration, such as an installed Effect agent, inspect its current package documentation and configuration. Do not replace it with another global provider.
- For browser code, use [`@monocle.sh/browser-sdk`](https://monocle.sh/docs/sdks/browser), not the Node SDK. Initialize once in the frontend entry point with a browser-approved DSN and explicit deployment environment.
- For Next.js or another framework-managed server bootstrap, use the framework's documented OTel hook. Check that it can export all claimed signals to Monocle. Do not run a second provider beside it.

An official SDK may already capture errors, HTTP, database calls, jobs, and runtime metrics. Check its enabled integrations before adding packages or manual spans.

## Configure generic Node.js OTel

1. Use the repository's package manager and installed TypeScript loader. Do not introduce a loader just for telemetry.
2. Select mutually compatible versions of `@opentelemetry/api`, `@opentelemetry/sdk-node`, resources, exporters, and instrumentation packages. Stable and experimental packages do not all share one version number.
3. Use `NodeSDK` with HTTP exporters. The `*-otlp-proto` trace, log, and metric exporters send protobuf. The corresponding `*-otlp-http` packages send JSON. Both transports are accepted. Do not install `*-otlp-grpc` for Monocle.
4. Apply [the connection settings](connection.md) to every exporter. Configure a resource with the real release metadata from [signals](signals.md).
5. Use compatible auto-instrumentations for the HTTP server, HTTP client, database driver, and logger that the application actually uses. Verify package support ranges against the lockfile.
6. Load telemetry before framework and client-library imports. A plain Node server can use `node --import ./telemetry.js <entrypoint>`. Adapt the path and loader to the existing project. ESM instrumentation may need the supported OTel module hook loaded before application imports. Do not assume CommonJS patching covers ESM.
7. Register one startup path and retain the SDK for graceful shutdown. Await `sdk.shutdown()` from the existing lifecycle handler after requests stop. Preserve the original signal behavior and exit status.

Read installed declarations before constructing providers and processors. Depending on the release, `PeriodicExportingMetricReader` is supplied through `metricReader` or `metricReaders`, and `BatchLogRecordProcessor` constructor shapes differ. Do not copy an incompatible example because it typechecks in another project.

## Preserve logs and exceptions

Configure both the OTLP log exporter and a bridge for the logger in use. Pino and Winston instrumentation have their own support ranges and forwarding requirements. Correlation-only instrumentation is not log export. `console.*` does not become OTLP logging merely because `NodeSDK` is installed.

Preserve current console, file, and remote logger sinks. Keep exporter diagnostics out of the exported logger path. Inspect existing serializers and redaction before forwarding records.

For uncaught request failures, prefer the framework's existing error-reporting integration. For a missing boundary, use the SDK exception API and set `ERROR` on the failing entry span. Do not also emit an explicit reporter log for the same reportable exception. Do not turn a handled client failure into a new issue.

For approved business spans, use `tracer.startActiveSpan` around a bounded operation. End the span in `finally`, record failures with native exception and status APIs, and rethrow the original error. Reuse existing instrumentation instead of wrapping every function.

## Configure a frontend without extra capture

Use `initMonocle` once and retain the returned client. Keep optional user identification, console forwarding, and analytics off unless requested. The browser SDK is not a session-replay SDK. Do not import Maple browser options or promise custom browser spans that the installed SDK does not support.

Configure the documented propagation host allowlist for the application's own APIs. Check the API preflight response before editing CORS. Keep existing allowed headers and origins. Include the ingest host in CSP `connect-src` when the application uses CSP.

For Vite, `@monocle.sh/vite-plugin` supplies build-version metadata. Keep existing plugins. Source-map uploads require separate CI credentials and authorization. Never put those credentials in the browser bundle.

## Verify the real startup

Follow [verification](verification.md). Exercise an actual route and a database or downstream call where present. Check async trace continuity, template routes, log correlation, and shutdown export.

AdonisJS uses Studio in development. For a cloud smoke run with a supported agent, temporarily run with `MONOCLE_DEV=false` and make a request. Do not change the permanent `dev` configuration. Keep the environment `development` for that run.

A browser page load alone might not send a record. Use a temporary synthetic `captureMessage` followed by `flush`, through the installed SDK API, and remove the probe afterwards.

## Sources

- [Monocle AdonisJS](https://monocle.sh/docs/frameworks/adonisjs)
- [Monocle browser SDK](https://monocle.sh/docs/sdks/browser)
- [OpenTelemetry Node.js startup](https://opentelemetry.io/docs/languages/js/getting-started/nodejs/)
- [OpenTelemetry JavaScript exporters](https://opentelemetry.io/docs/languages/js/exporters/)
- [OpenTelemetry JavaScript instrumentation](https://opentelemetry.io/docs/languages/js/instrumentation/)
