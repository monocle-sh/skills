# Configure the browser SDK

Use `@monocle.sh/browser-sdk` in the frontend, never a Node.js SDK.

## Initialize once

Call `initMonocle` once at the frontend entry point with a browser-approved DSN and the deployment environment, and keep the returned client. Use the project's existing environment validation. Without a DSN, leave initialization inactive at that boundary and report it. Do not add a no-op wrapper or an invented `enabled` option. Add the ingest host to the CSP `connect-src` if the project has a CSP.

The default integration is `errors()`. An explicit integration list replaces the default, so keep `errors()` in it. Network, console, analytics, and replay capture need the user's selection.

## Capture framework errors

`errors()` sees only errors that reach the window. Vue catches errors from components, event handlers, and `setup`, then only logs them. In a Vue application, including in Inertia's `createInertiaApp` setup, set `app.config.errorHandler` to call the client's `captureException(error)`, and keep calling any handler the application already had.

## Attribute users

Call the client's `setUser({ id, email, name })` from the frontend's existing authentication state. Restore it after reload, replace it on account changes, and call `setUser(null)` when anonymous or logged out. Analytics does not use this identity.

- In React, synchronize it in an effect on the authentication state.
- With Inertia, read `usePage()` inside a persistent layout. Do not mount the identity component beside Inertia's root `App`: it runs before the first page, and `usePage()` has no props yet.
- Reuse an existing auth query cache, such as Tuyau with TanStack Query. Do not add an auth endpoint, HTTP interceptor, or global router listener.

## Add selected options

- Network tracing: configure `network()` with propagation restricted to the application's own APIs. Check preflight responses before changing CORS.
- Analytics: use `analytics()`. Avoid duplicate page views from the router, and personal event properties.
- Replay: `replay()` does not start recording. Connect `grantConsent()` and `revokeConsent()` to the visitor consent controls, and agree on sampling and masking. Inputs are masked by default, visible text and media are not. Replay identity needs separate approval. Without consent controls, report replay as prepared but inactive.

## Verify

A page load may emit nothing. Send a temporary `captureMessage` and `flush` through the installed client, then remove the probe. For analytics only, check a page view instead.

## Sources

- [Browser SDK](https://monocle.sh/docs/sdks/browser)
