# Configure Python applications

## Select one initialization path

Inspect `pyproject.toml`, the lockfile, the real server command, worker configuration, and existing OTel setup. Use the repository's package manager and supported Python version.

Choose either existing zero-code instrumentation or programmatic initialization. Do not layer `opentelemetry-instrument` on top of duplicate provider and framework setup. Check compatible versions of `opentelemetry-api`, `opentelemetry-sdk`, the HTTP exporter, and each instrumentation package. Core and instrumentation packages do not use identical version numbers.

## Configure providers and exporters

1. Use `opentelemetry-exporter-otlp-proto-http`, not the gRPC exporter. Apply [the connection settings](connection.md) to all enabled signals.
2. For programmatic traces, configure `TracerProvider`, `BatchSpanProcessor`, and the HTTP `OTLPSpanExporter`, then register the provider before instrumented work starts.
3. For metrics, configure `MeterProvider` with `PeriodicExportingMetricReader` and the HTTP `OTLPMetricExporter`. Create instruments in their owning module or application scope, not per request.
4. For enabled logs, configure an OTel logger provider, batch log processor, HTTP log exporter, and a bridge for the application's actual logger. The SDK's logging imports vary by release, so inspect the installed package documentation.
5. Attach a shared resource with [release metadata](signals.md). Keep a per-worker instance identity when instances are exposed.
6. Use the framework's startup and teardown hooks. Flush and shut down providers after work stops, including short-lived workers and commands.

For zero-code setups, explicitly select HTTP protobuf and configure each enabled exporter through the supported environment variables. Merely defining `MONOCLE_DSN` does not configure an upstream exporter. Check that the instrumented launch command is the command used by containers and deployment services.

## Use native framework instrumentation

For FastAPI, use a compatible `FastAPIInstrumentor` and its documented application hook. For Django or Flask, use the matching instrumentation and framework lifecycle. Avoid handwritten replacement middleware when a compatible maintained integration exists.

Instrument the actual outgoing clients and database drivers, such as requests, httpx, SQLAlchemy, or psycopg, using packages that support the installed versions. An installed instrumentation package does not prove it was activated. Disable query-parameter and sensitive header capture.

Use W3C trace-context propagation and the framework's context support. For Celery or another worker system, instrument dispatch and execution using supported hooks. Add Monocle's job attributes and links from [signals](signals.md) where the upstream instrumentation does not supply them.

Prefork servers need special care. Do not start exporter threads in a master process and assume they work after fork. Follow the SDK and server's post-fork or worker-init guidance. Check reload and repeated application-factory calls for duplicate handlers and processors.

## Preserve logging and error handling

Keep existing `logging` handlers, logger levels, and structured fields. Correlation support alone is not an OTLP bridge. A formatted `trace_id` in stdout is not native log correlation. Confirm real OTLP log IDs before claiming log-to-trace links.

Keep exporter diagnostics out of the exported log path to prevent recursion. Check existing log redaction before forwarding records.

For approved bounded business work, `tracer.start_as_current_span` can be used as a decorator or context manager. Its default exception behavior may already record failures and set status. Do not add duplicate manual exception recording. If recording manually, set failure status through `Status` and `StatusCode` as well as recording exception details.

For unhandled request errors, use the framework error boundary without suppressing or replacing its response handling. A recovered child exception is not an issue. Explicit out-of-span reports use the log contract from [signals](signals.md). Ordinary `logger.exception` does not guarantee the `monocle.log.source` marker or required attributes.

## Verify

Follow [verification](verification.md). Use the actual ASGI, WSGI, worker, or CLI entry point. A direct import can check bootstrap construction but does not prove a worker hook or request integration executes.

Check two concurrent requests for isolated context, a matched route, one downstream or database call, the enabled log bridge, and final export. Include the actual worker model in lifecycle checks when using multiple processes.

## Sources

- [Python exporters](https://opentelemetry.io/docs/languages/python/exporters/)
- [Python instrumentation](https://opentelemetry.io/docs/languages/python/instrumentation/)
- [Python zero-code configuration](https://opentelemetry.io/docs/zero-code/python/configuration/)
- [FastAPI instrumentation](https://opentelemetry-python-contrib.readthedocs.io/en/latest/instrumentation/fastapi/fastapi.html)
- [Monocle semantic conventions](https://monocle.sh/docs/opentelemetry/semantic-conventions)
