---
name: onboarding-monocle
description: "Sets up Monocle in an existing application with official Monocle SDKs or native OpenTelemetry, in any language that has an OTLP HTTP exporter. Use to install Monocle, connect a service, or add traces, logs, metrics, errors, user attribution, or source maps."
---

# Set up Monocle in an application

Configure the application, keep its behavior, and verify what it sends. Do not write an adapter, exporter, or SDK package.

## References

Open only the references that match the application.

| Open when | Read |
| --- | --- |
| The server is AdonisJS | [stack-adonisjs.md](references/stack-adonisjs.md) |
| The server is Next.js | [stack-nextjs.md](references/stack-nextjs.md) |
| The server is another Node.js framework, such as NestJS, Express, or Fastify | [stack-node-otel.md](references/stack-node-otel.md) |
| The application has a browser frontend | [stack-browser.md](references/stack-browser.md) |
| The application ships compiled JavaScript | [javascript-source-maps.md](references/javascript-source-maps.md) |
| The server is Go, Python, or Rust | [stack-go.md](references/stack-go.md), [stack-python.md](references/stack-python.md), [stack-rust.md](references/stack-rust.md) |
| You configure OpenTelemetry exporters without a Monocle SDK | [connection.md](references/connection.md) |
| You set or check telemetry attributes yourself | [signals.md](references/signals.md) |
| Logs or requested capture contain sensitive values | [privacy.md](references/privacy.md) |
| You verify the installation | [verification.md](references/verification.md) |
| You write the team recap | [recap.md](references/recap.md) |

For another language, such as PHP, Ruby, Java, .NET, or Elixir, use its official OpenTelemetry SDK with OTLP HTTP exporters, and follow [connection.md](references/connection.md) and [signals.md](references/signals.md). Check the documentation of the installed versions before choosing APIs.

## 1. Inspect the application

Read project guidance, manifests, lockfiles, start and build commands, and existing telemetry. List the deployable services, frameworks, loggers, databases, queues, and authentication.

Use one Monocle service per deployed unit. A frontend served by the same server shares its service. A separately deployed frontend gets its own service. Reuse existing Monocle services.

## 2. Agree on coverage

A general installation includes:

- Server requests, outgoing calls, and trace context propagation.
- Database calls, jobs, runtime metrics, and the release version, which Monocle uses to track deployments.
- Unhandled exceptions and the existing application logs, correlated with traces.
- Browser errors when the application has a frontend.
- The authenticated user's ID, email, and name when authentication exists. Do not add authentication or other profile fields.
- Source-map upload for compiled JavaScript, with the `MONOCLE_API_KEY` project token from CI secrets. See [javascript-source-maps.md](references/javascript-source-maps.md).

An explicit analytics-only request adds browser analytics and nothing else. Analytics-only and uptime-only requests need no release version or source maps.

Ask one grouped question about optional features that remain undecided:

> The base setup includes server traces and logs, browser errors, user attribution with ID, email, and name, release tracking, and source-map upload from CI. Would you also like analytics, session replay, or browser network tracing? Replay needs visitor consent and masking review.

Skip what the user already answered, and wait for the answer before enabling an option. In noninteractive runs, leave optional features off. Respect explicit exclusions and project privacy rules.

If Sentry, PostHog, or another vendor covers the same features, ask which features to keep or move before changing them. Continue the work that does not overlap. A vendor's presence alone does not prove a conflict.

## 3. Connect the service

Use the existing DSN and environment. Keep credentials out of tracked files, logs, and reports. Never create a project token, and never ask the user to paste a token or DSN key into the conversation.

With the Monocle MCP, confirm the organization and project with `whoami`. With authorization, create missing services with `setup_service` and follow its SDK instructions. Without the MCP, use an existing DSN or the service's **SDK connection** page. Do not change MCP configuration without permission.

Without credentials, finish local configuration with an empty example value and report cloud verification as blocked. There is no test DSN.

## 4. Configure the application

- Use the official Monocle SDK and its configurator when one exists for the stack. Otherwise use native OpenTelemetry.
- Initialize telemetry once, before instrumented code loads. Extend existing providers instead of adding a competing one.
- Keep SDK defaults. Add a custom processor, attribute allowlist, or sanitizer only for a demonstrated need that SDK controls cannot meet.
- Preserve error handlers, logger sinks, shutdown behavior, and exit codes. Report each unhandled failure once.
- Use existing instrumentation. Do not invent routes, durations, or attributes.
- Take the release version from the application's existing release value. Do not use placeholders or process start times.
- Reuse existing build and publication scripts. Add the source-map upload to an existing CI workflow. Without CI, give the upload commands in the recap. Do not create CI, Docker, release infrastructure, or deployment declarations without a request.
- Keep HTTP body capture off. If an explicit option stays in the configuration, explain its privacy and quota cost in a short comment.

## 5. Verify and report

Follow [verification.md](references/verification.md) within the project's allowed checks.

In your final reply, report configured coverage, optional choices, executed checks, and blockers. Separate configuration, local export, and cloud storage. Separate source-map preparation, upload, and resolved frames. For each blocker, name the missing credential, build, or publication step and the feature it unlocks.

Leave the team a short recap that follows [recap.md](references/recap.md). Keep check IDs and verification logs out of the repository.

Do not deploy, publish, commit, push, rotate credentials, or change remote infrastructure without separate authorization.
