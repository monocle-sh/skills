# Configure Next.js

Next.js has no Monocle agent. Set up OpenTelemetry as described in [stack-node-otel.md](stack-node-otel.md), started from `instrumentation.ts`, and the browser SDK as described in [stack-browser.md](stack-browser.md).

- In `register()`, import a Node-only telemetry module when `process.env.NEXT_RUNTIME === 'nodejs'`, and start one `NodeSDK` there.
- Next.js creates the request SERVER span itself, with legacy HTTP attribute names that Monocle normalizes. Check which instrumentation produced it before relying on `instrumentation-http` hooks.
- Next.js records request errors on an internal child span, which opens no issue. Export `onRequestError` from `instrumentation.ts` and emit the exception reporter log there.
- Next.js has no public API to add attributes to its request span. Report server-side user attribution as unavailable. Do not import Next.js internal tracer modules. Browser identity still works.
- Next.js calls `process.exit` on `SIGTERM` and `SIGINT`, which loses pending telemetry. Set `NEXT_MANUAL_SIG_HANDLE=true` in the runtime environment. In `register()`, handle both signals: await `sdk.shutdown()`, then exit with code 143 or 130.
- Initialize the browser SDK in `instrumentation-client.ts`.

## Prepare source maps

Check that `next build` writes maps for `.next/static` and `.next/server`. Inject and upload them with the CLI, as described in [javascript-source-maps.md](javascript-source-maps.md), before a Docker image copies the output. `productionBrowserSourceMaps` makes `next start` serve browser maps publicly: delete the `.map` files after upload.

## Sources

- [Next.js OpenTelemetry](https://nextjs.org/docs/app/guides/open-telemetry)
- [Next.js `instrumentation.ts` and `onRequestError`](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation)
