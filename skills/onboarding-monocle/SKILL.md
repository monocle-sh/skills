---
name: onboarding-monocle
description: "Configures Monocle observability in an application or monorepo using official SDKs or native OpenTelemetry. Use when asked to install Monocle, connect a service, or instrument Node.js, Go, Rust, or Python applications."
---

# Set up Monocle in an application

Connect the requested applications to Monocle, preserve their behavior, and verify the signals you claim to support. Configure the user's application. Do not build a reusable adapter, exporter, or SDK package.

## 1. Inspect the repository

Read project guidance, manifests, lockfiles, start commands, deployment configuration, and existing telemetry setup. Identify deployable services, runtimes, frameworks, database drivers, queue clients, and loggers. Exclude libraries with no runtime entry point and repositories outside the requested scope.

List the services and proposed coverage in a short message. Reuse existing Monocle services. An AdonisJS app serving its own Edge or Inertia frontend can use one service and DSN. A separately deployed frontend is a separate service. Preserve deliberate existing service boundaries.

Read [the connection contract](reference/connection.md), [the signal requirements](reference/signals.md), and the reference for each runtime you need:

- [Node.js](reference/nodejs.md), including official AdonisJS and browser SDK paths.
- [Go](reference/go.md).
- [Rust](reference/rust.md).
- [Python](reference/python.md).

If the stack is not listed, use its native OTel SDK and upstream documentation with the connection and signal references. Do not invent a Monocle package or unsupported framework API.

## 2. Choose the smallest useful setup

Prefer an existing official Monocle SDK when it supports the application's installed framework version. Otherwise configure native OpenTelemetry and compatible upstream instrumentation. Extend an existing provider instead of installing a competing global provider.

The default is technical coverage of the requested services:

- Incoming HTTP requests, outgoing HTTP calls, and distributed trace context.
- Database calls and jobs where compatible instrumentation exists.
- Unhandled failures reported once, with useful exception type and stack information.
- Existing application logs through an OTLP bridge, after checking what those logs contain.
- Resource version metadata and supported runtime metrics where available.

If a logger can emit secrets or personal data, exclude or redact those records before forwarding. If that cannot be done safely within scope, leave forwarding off and report the gap.

Use the required attributes for each enabled feature. Do not ask users to choose individual semantic-convention keys. When a library lacks instrumentation, add a small local hook only if necessary for the promised coverage. Otherwise report the limit. Do not turn missing support into an adapter-development project.

## 3. Ask at most one enrichment question

Inspect first. If relevant enrichments exist, ask one grouped question with a recommendation and wait for the answer before adding them:

> I found authenticated users and an order-processing workflow. Would you like opaque user IDs on telemetry, business spans around order processing, both, or neither? I recommend neither for the initial technical setup.

Only offer choices that match the actual application. Skip the question if there are no relevant enrichments or the user already chose. If the user requests a noninteractive run, keep optional enrichments off.

Bodies, headers, cookies, credentials, and AI inputs or outputs are outside the standard setup. Do not offer a long settings questionnaire. For an explicit request to collect sensitive content, read [the privacy procedure](reference/privacy.md) and agree on a bounded capture policy first.

Essential questions about an unknown project, consent, or missing credentials are separate from the enrichment question. Never guess their answers to avoid asking.

## 4. Resolve the connection

Use the user's existing DSN and environment when available. Never print the DSN or exporter headers. Keep real values out of tracked examples and reports.

If Monocle MCP tools are connected, discover their current schemas. Use `whoami` to confirm the organization and project. With authorization to create the required services and DSNs, call `setup_service` for missing connections and follow its current SDK-specific instructions. Do not assume it returns installation steps for every language. Do not create unrelated resources.

Without MCP, use an existing DSN or direct the user to the service's **SDK connection** page. Do not install or change MCP configuration without permission. If credentials are unavailable, finish local configuration with an empty example value, validate locally where possible, and state that cloud verification remains blocked. There is no magic test DSN.

## 5. Configure and instrument

Use the project's package manager and startup hooks. Initialize telemetry before the code it instruments, once per process. Preserve existing exporters, log sinks, signal handlers, error handlers, and exit codes.

Apply [signal requirements](reference/signals.md) only to the enabled features. Prefer compatible auto-instrumentation. Add missing attributes at the point that knows their values, such as a matched-route hook or job boundary. Never guess routes, durations, exception types, token usage, or queue latency.

Keep configuration local to the existing application structure. Use batch exporters, bounded timeouts, and graceful shutdown. Do not export the exporters' own diagnostics back through the application log bridge. Preserve context across async work and isolate concurrent requests.

Do not change AdonisJS Studio defaults to force cloud export. Follow the temporary verification override in the Node.js reference instead.

## 6. Verify and hand off

Run [the verification procedure](reference/verification.md) for each configured service. Respect project guidance about allowed checks. A console exporter, empty OTLP request, or successful build alone does not prove the application reaches Monocle.

Report:

- The services, signals, and relevant attributes configured.
- The optional features enabled and those deliberately left off.
- The executed checks and concrete observations, without credentials or captured private data.
- One status per service: **cloud verified**, **local export verified**, or **not verified**, with the remaining blocker.
- Any deployment environment variables or actions the user still needs to supply.

Do not deploy, publish, commit, push, rotate credentials, or change remote infrastructure unless separately authorized. Leave unrelated files alone.
