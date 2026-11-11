---
name: onboarding-monocle
description: "Configures Monocle using official SDKs or native OpenTelemetry. Use to install Monocle, connect services, or instrument Node.js, Go, Rust, or Python applications."
---

# Set up Monocle in an application

Configure the requested application, preserve its behavior, and verify its telemetry. Do not build an adapter, exporter, or SDK package.

## 1. Inspect the application

Read project guidance, manifests, lockfiles, startup commands, publication scripts, and existing telemetry. Identify deployable services, frameworks, loggers, databases, queues, and authentication.

State the services and proposed coverage. Reuse existing Monocle services and deliberate service boundaries. AdonisJS with its own Edge or Inertia frontend can share one service and DSN. A separately deployed frontend uses a separate service.

Read [connection settings](reference/connection.md), [signal requirements](reference/signals.md), and the relevant runtime guide:

- [Node.js, AdonisJS, and browser](reference/nodejs.md).
- [Go](reference/go.md).
- [Rust](reference/rust.md).
- [Python](reference/python.md).

For other stacks, use native OTel and upstream documentation. Check installed versions before choosing APIs.

## 2. Establish coverage

An explicit analytics-only request adds browser analytics only. Do not add backend instrumentation, error capture, identity, or source-map work. Preserve existing instrumentation.

For a general installation, include:

- Server requests, outgoing calls, and distributed context.
- Supported database calls, jobs, runtime metrics, and release metadata.
- Unhandled exceptions and existing application logs with native trace correlation.
- Browser errors, when the application has a frontend.
- Authenticated user ID, email, and name when available. Respect identity opt-outs and project restrictions. Do not add authentication or collect other profile fields.
- Source-map preparation for compiled JavaScript error coverage, unless excluded. Uploads require a private project token and authorization.

Prefer official SDKs and their defaults. Extend existing providers rather than adding competing ones. Preserve logger sinks, useful diagnostic fields, and deliberate opt-outs. Apply the [privacy procedure](reference/privacy.md) to actual sensitive content, not hypothetical risks.

Ask one grouped question for relevant, supported options that remain undecided:

> The base setup includes server traces and logs, browser errors, user attribution with existing ID, email, and name, and source-map preparation. Would you also like analytics, session replay, or browser network tracing? Replay needs visitor consent and masking review. Source uploads need a private token and authorization.

Adapt the question to the application. Include extra console capture or business spans only when relevant. Skip answered choices. Wait for the answer before enabling additions. In noninteractive runs, leave unrequested additions off without disabling existing collectors.

If Sentry, PostHog, or another vendor overlaps, ask which features to retain or replace. Resolve that choice before adding overlapping instrumentation or removing an integration. Different features can use different vendors. Continue non-conflicting work. Vendor presence alone proves neither incompatibility nor a memory leak.

## 3. Resolve the connection

Use the existing DSN and environment. Keep credentials out of tracked files, logs, and reports.

With Monocle MCP, discover the current schemas and confirm the organization and project through `whoami`. With authorization, use `setup_service` for missing services and DSNs. Follow its SDK-specific instructions where available.

Without MCP, use an existing DSN or the service's **SDK connection** page. Do not change MCP configuration without permission. If credentials are missing, finish local configuration with an empty example value and report cloud verification as blocked. There is no test DSN.

## 4. Configure the application

Use its package manager, framework configurator, and startup hooks. Initialize telemetry once, before instrumented imports. Keep configuration in the existing application structure.

Preserve exporters, error handlers, logger sinks, shutdown behavior, and exit codes. Use bounded batch exporters. Keep exporter diagnostics outside their own log bridge. Preserve async context and isolate concurrent requests.

Apply signal requirements only to agreed features. Prefer existing instrumentation. Add a local hook only for a demonstrated gap. Do not fabricate routes, durations, or attributes.

Use existing build and publication scripts. CI and Docker are not prerequisites. Do not create release infrastructure or deployment declarations without a request. Follow the runtime guide for version detection and source maps.

Keep body capture off by default. If an explicit option remains in configuration, explain its privacy and quota tradeoff with a short comment. Use multiline JSDoc in TypeScript. Do not restate every SDK default. Preserve AdonisJS Studio defaults.

## 5. Verify and report

Run [verification](reference/verification.md) within the project's allowed checks. Report configured coverage, optional choices, executed checks, and remaining blockers. Distinguish configuration from actual emission and cloud storage.

For each blocker, name the missing feature and next credential, build, or publication step. Separate source-map preparation, upload, frame resolution, and deployment observations. Say which checks need a deployed build.

Put the full report in your final reply. Leave the team one short recap that follows [the recap guide](reference/recap.md). Keep check IDs, audit evidence, and verification logs out of the repository.

Do not deploy, publish, commit, push, rotate credentials, or change remote infrastructure without separate authorization. Leave unrelated files alone.
