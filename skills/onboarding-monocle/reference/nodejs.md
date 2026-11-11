# Configure Node.js applications

## Use the existing SDK path

Inspect installed versions, module format, and production startup before choosing instrumentation.

- For supported AdonisJS versions, run `node ace add @monocle.sh/adonisjs-agent` and review its changes. Keep its generated bootstrap, provider, middleware, and configuration. The agent already covers supported HTTP, database, logger, exception, and job integrations. Do not add `serviceName`: Monocle Cloud takes the service name from the DSN, and Studio falls back to `OTEL_SERVICE_NAME`, `APP_NAME`, or the `package.json` name.
- Preserve other official Monocle integrations, including Effect. Inspect their package documentation before extending them.
- Monocle publishes Node.js agents for AdonisJS and Effect only. For NestJS, Express, Fastify, Next.js, and other frameworks, use the generic OTel setup below with official `@opentelemetry/*` packages. That setup is the supported path, not a custom adapter. Check npm before you use any other `@monocle.sh/*` package name.
- For framework-managed OTel, use the documented startup hook. Do not add a second global provider.
- For browsers, use `@monocle.sh/browser-sdk`, not the Node SDK.

Keep the SDK defaults unless the application needs an override.
Do not add custom span or log processors, global attribute allowlists, or sanitizers for hypothetical privacy risks.
A custom processor needs a demonstrated requirement that supported SDK or logger controls cannot meet.
Explain that requirement before adding it.

## Configure generic Node.js OTel

1. Use the project's package manager, existing loader, and version pinning style. Select mutually compatible API, SDK, resource, exporter, and instrumentation versions. Stable and experimental packages have different version numbers.
2. Configure one `NodeSDK` with OTLP HTTP exporters. `*-otlp-proto` packages send protobuf. `*-otlp-http` packages send JSON. Monocle accepts both, not gRPC. Apply [connection settings](connection.md) to every exporter and [resource attributes](signals.md) to the provider.
3. Enable compatible instrumentation for libraries the application uses. Check support ranges against the lockfile. For `@opentelemetry/instrumentation-pg`, set `ignoreConnectSpans: true`, because Monocle lists `pg.connect` and `pg-pool.connect` spans as queries.
4. Load telemetry before instrumented imports. Plain Node can use `node --import ./telemetry.js <entrypoint>`. Adapt the loader and path to the application. ESM instrumentation may require the supported OTel module hook.
5. Retain the SDK and await `sdk.shutdown()` after requests stop through the existing lifecycle handler. Preserve signal behavior and exit status. An `uncaughtException` hook that starts a flush without awaiting it loses the report, because Node exits first. In that hook, emit the reporter log, await `sdk.shutdown()` with a timeout of a few seconds, then exit with code 1.

Read installed declarations for provider and processor constructors. Releases differ on `metricReader`, `metricReaders`, and `BatchLogRecordProcessor` arguments.

## Attribute users and errors without an agent

Monocle reads `user.id`, `user.email`, and `user.name` from the request's SERVER span. A child span from framework or middleware instrumentation does not count. With `@opentelemetry/instrumentation-http`, set these attributes in its `applyCustomAttributesOnSpan` hook. The hook runs when the response ends and receives the incoming request. Read the user that existing authentication attached to that request, such as `request.user` in an Express-based NestJS application. Fastify keeps its request object apart from `request.raw`, so check which object the hook receives.

Monocle opens an issue from an exception on a failed entry span. Framework error boundaries usually run inside a child span, so an exception recorded there stays in the trace without opening an issue. Report each unexpected 5xx failure once from the existing boundary, such as a NestJS global filter that extends `BaseExceptionFilter` and calls `super.catch`, or Express error middleware. Emit the reporter log from [signals](signals.md) through the OTel logs API in the active context. Get the logger from the API package that the installed `NodeSDK` registers its logger provider with. With `@opentelemetry/sdk-node` 0.301 and `@opentelemetry/api` 1.10, use `logs` from `@opentelemetry/api`. A logger from `@opentelemetry/api-logs` then reads a separate global and drops the log without an error. Add the user attributes when the boundary has the authenticated user. Keep the framework's response. Do not report expected 4xx errors.

This reporter log carries no `monocle.exception.debug_ids`, and Monocle resolves JavaScript frames only through debug IDs. Uploaded server maps therefore leave its frames minified. Prepare the uploads anyway, and report server frame resolution as unavailable with generic OTel.

## Configure Next.js

Next.js has no Monocle agent. Use generic OTel from `instrumentation.ts`:

- In `register()`, import a Node-only telemetry module when `process.env.NEXT_RUNTIME === 'nodejs'`. Start one `NodeSDK` there.
- Next.js creates the SERVER span for each request itself, with legacy HTTP attribute names that Monocle normalizes. Check which instrumentation produced the decoded SERVER span before you rely on `instrumentation-http` hooks.
- Next.js records a request error on an internal child span, which does not open an issue. Export `onRequestError` from `instrumentation.ts` and emit the reporter log there.
- Next.js has no public API to add attributes to its request span. Report server-side user attribution on traces as unavailable. Do not import Next.js internal tracer modules. Browser identity still uses the browser SDK.
- Next.js calls `process.exit` on `SIGTERM` and `SIGINT`, so `beforeExit` never runs and pending telemetry is lost. Set `NEXT_MANUAL_SIG_HANDLE=true` in the runtime environment. In `register()`, handle both signals: await `sdk.shutdown()`, then exit with code 143 or 130.
- Initialize the browser SDK in `instrumentation-client.ts`.
- Check that `next build` writes maps for `.next/static` and `.next/server`. Inject and upload them with the CLI before the Docker image copies the output. `productionBrowserSourceMaps` makes `next start` serve browser maps publicly. Delete the `.map` files after upload, before anything serves or copies the output.

## Preserve logs and exception reporting

Use the existing logger bridge and OTLP log exporter. Correlation alone does not export logs, and installing `NodeSDK` does not forward `console.*`. Preserve console, file, and remote sinks. Keep exporter diagnostics outside their own bridge.

Leave AdonisJS Pino instrumentation enabled unless explicitly excluded or demonstrably unsafe. Disabling it removes OTel collection and correlation, not Pino's other outputs. Preserve ordinary structured fields, correlation IDs such as `x-request-id`, and error type, message, and stack. Field names alone do not establish sensitive content. Follow [privacy handling](privacy.md) when actual values require redaction.

Use the framework's exception integration. For a missing boundary, use the SDK exception API and native `ERROR` status. Do not add another reporter for an already reported failure or promote handled client failures into issues. An ordinary Pino error log alongside an SDK exception report does not alone prove duplicate issues.

For selected business spans, use `startActiveSpan` around a bounded operation. Record failures, end in `finally`, and rethrow the original error. Do not wrap existing instrumentation in duplicate spans.

## Configure AdonisJS identity and body capture

Keep `monocle_middleware` first in `router.use`, before body parsing, session, and authentication middleware, as registered by the official configurator. Do not move it after authentication to populate a resolver.

After existing authentication resolves, call `Monocle.setUser({ id, email, name })` for the authenticated user. Use the stable internal ID and available email and name fields, respecting project restrictions. Map the actual model fields, such as `fullName` to `name`. Do not pass the whole user object.

Keep the SDK's automatic context defaults unless a project restriction requires an override. Do not add `userContext: false` or a custom resolver just to use `Monocle.setUser`. Keep anonymous requests unattributed and context request-local.

For an identity opt-out, disable automatic context with `userContext: false` and add no manual attribution.

Body capture is off by default. If retaining an explicit option, explain it:

```ts
http: {
	/**
	 * Payload capture increases telemetry volume and quota usage.
	 * Bodies can contain personal data or secrets. Enable only where
	 * needed, with size limits and reviewed redaction.
	 * @see https://monocle.sh/docs/frameworks/adonisjs/http
	 */
	captureBodies: false,
},
```

URL sanitization is a separate, opt-in SDK feature. Use its supported options for identified sensitive URL values. Do not strip all queries or headers as an onboarding default.

## Configure the browser

Initialize `initMonocle` once at the frontend entry point with a browser-approved DSN and deployment environment. Retain the returned client. Use existing environment validation and direct initialization when configured. If credentials are absent, keep initialization inactive at that boundary and report it. Do not introduce a no-op wrapper, invented `enabled` option, or optional clients throughout the application. Add the ingest host to CSP `connect-src` if needed.

The default integration is `errors()` only. An explicit integration array replaces defaults. Keep `errors()` for general error coverage, or use `[analytics()]` for a new analytics-only setup. Preserve existing collectors. Browser network, console, analytics, and replay capture require selection.

- For authenticated error attribution, call the client's `setUser({ id, email, name })` with available, permitted fields. Restore it after reload, replace it on account changes, and clear it with `setUser(null)` when anonymous or logged out. Context also applies to enabled logs and network events. Analytics does not inherit this identity, and analytics-only setup needs no identity hook.
- For selected network tracing, configure `network()` with propagation restricted to the application's APIs. Inspect preflight responses before changing CORS. Preserve other allowed headers and origins.
- For selected analytics, use `analytics()`. Avoid duplicate router page views and personal event properties.
- For selected replay, check support for the experimental replay entry. `replay()` does not start recording. Connect `grantConsent()` and `revokeConsent()` to visitor consent controls. Agree on sampling and masking. Inputs are masked by default, visible text and media are not. Review synthetic recordings and block sensitive subtrees. Replay identity needs separate approval. Without consent controls or verification, report replay as prepared but inactive.

Use the frontend's existing authentication state, not an HTTP interceptor. In React, synchronize through an effect on that state. Reuse an existing Tuyau-backed TanStack auth query cache, or Inertia's `usePage()` inside a persistent layout. Do not add an auth endpoint, request, or global router listener when that state is already available. Clean up any necessary listeners on teardown and HMR.

## Prepare source maps and releases

For compiled JavaScript error coverage, follow the [source-map guide](https://monocle.sh/docs/sdks/source-maps) for each relevant output. Reuse build scripts and plugins. Analytics-only setup needs no maps.

- Vite uses `@monocle.sh/vite-plugin` for version metadata and uploads. Without `MONOCLE_API_KEY`, its default configuration generates no maps and uploads nothing. Report that gap.
- Compiled Node uses the official CLI's `sourcemaps inject`, then `sourcemaps upload`, after the final build, with original sources available. Follow the guide's startup requirements. Do not rebuild after injection.
- AdonisJS with Inertia has separate browser and server outputs. Do not upload Vite output again through the CLI. Exclude `.map` files from public deployment artifacts.

Uploads need a private project token and authorization. Keep `MONOCLE_API_KEY` in authorized build secrets, never browser code, `VITE_` variables, tracked files, or persistent Docker layers. A token-bearing Vite build can upload automatically. Check authorization before running it.

CI and Docker are not prerequisites. Use SDK version detection or an existing real release value. Supported Monocle SDKs accept `MONOCLE_VERSION`. Generic OTel needs `service.version`. Keep the intended version in the published artifact without requiring production `.git`. Do not use placeholders or process-start timestamps.

Deployment detection uses eligible entry spans with usable versions. The first version is a baseline, and observation time is not exact deployment completion. Source maps match debug IDs independently of release versions and declarations.

With an existing CI workflow, add the upload after the final build and expose `MONOCLE_API_KEY` from CI secrets to that step only. In a Docker build, use a build secret, never a build argument. Pass the commit SHA into the image as `MONOCLE_VERSION` and keep `.map` files out of the runtime image.

Without a publication workflow, prepare local configuration and give the manual build and upload commands in the report and the recap. Do not invent a deployment or add CI or Docker. Report configuration, upload, deployment observation, and resolved source frames separately.

## Verify startup and emission

Follow [verification](verification.md). AdonisJS uses Studio in development. For an authorized cloud check, temporarily use `MONOCLE_DEV=false` and keep the environment `development`. Do not change permanent Studio defaults.

A browser page load may not emit errors. Use a temporary synthetic `captureMessage` and `flush` through the installed SDK, then remove the probe. Analytics-only verification uses a page view or selected event instead.

## Sources

- [AdonisJS setup](https://monocle.sh/docs/frameworks/adonisjs)
- [AdonisJS configuration](https://monocle.sh/docs/frameworks/adonisjs/configuration)
- [Users and exceptions](https://monocle.sh/docs/frameworks/adonisjs/users-and-exceptions)
- [HTTP capture](https://monocle.sh/docs/frameworks/adonisjs/http)
- [Browser SDK](https://monocle.sh/docs/sdks/browser)
- [Source maps](https://monocle.sh/docs/sdks/source-maps)
- [Deployments](https://monocle.sh/docs/features/deployments)
- [OTel Node.js startup](https://opentelemetry.io/docs/languages/js/getting-started/nodejs/)
- [OTel JavaScript exporters](https://opentelemetry.io/docs/languages/js/exporters/)
- [OTel JavaScript instrumentation](https://opentelemetry.io/docs/languages/js/instrumentation/)
- [OTel HTTP instrumentation options](https://github.com/open-telemetry/opentelemetry-js/tree/main/experimental/packages/opentelemetry-instrumentation-http)
- [Next.js OpenTelemetry](https://nextjs.org/docs/app/guides/open-telemetry)
- [Next.js `instrumentation.ts` and `onRequestError`](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation)
