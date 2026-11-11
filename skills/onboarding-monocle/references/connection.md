# Monocle connection contract

## Transport

Monocle receives OTLP over HTTP. Binary protobuf is recommended. OTLP JSON is also supported. gRPC is not supported.

| Setting | Value |
| --- | --- |
| Hosted origin | `https://ingest.monocle.sh` |
| Signal paths | `/v1/traces`, `/v1/logs`, `/v1/metrics` |
| Maximum request body | 10 MiB |
| Compression | gzip when supported by the exporter |

A self-hosted or proxy connection uses the origin supplied by its DSN. There is no Maple-style region selection or fallback to another host after an authentication error.

## DSN and request headers

The DSN shape is `https://<key>@<host>/<service-uuid>`. Its environment is configured separately.

| Request field | Source |
| --- | --- |
| Export origin | DSN scheme, hostname, and optional port, without user information or path |
| `x-api-key` | DSN username |
| `x-monocle-service-id` | Service UUID from the DSN path |
| `x-monocle-env` | Existing project environment slug, normally `development`, `staging`, or `production` |

New connections use explicit service identity. `service.name` is replaced by the authenticated service's canonical name on traces, logs, and metrics. `deployment.environment.name` does not choose the destination environment. Client-supplied organization and project attributes cannot select another destination.

The standard OTel environment configuration, once populated through the application's configuration mechanism, has this shape:

```dotenv
OTEL_EXPORTER_OTLP_ENDPOINT=https://ingest.monocle.sh
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_EXPORTER_OTLP_HEADERS=x-api-key=<dsn-key>,x-monocle-service-id=<service-uuid>,x-monocle-env=development
OTEL_SERVICE_NAME=api
```

These are placeholders, not valid credentials. `MONOCLE_DSN` is consumed by Monocle SDKs, not automatically by a generic OTel exporter. Configure the three headers explicitly or translate the DSN in the application's existing configuration module. A generic exporter will not infer them from a credential-bearing URL.

A base endpoint normally has signal paths appended by the SDK. Signal-specific environment variables and explicit exporter URL options often expect the complete `/v1/<signal>` URL. Check the installed exporter's behavior to avoid missing or doubled paths. Configure every enabled signal, not traces alone. Explicit exporter options can override environment settings.

## Credentials

Current service DSNs use ingestion-only keys and can be shared by the official server and browser SDKs of that service. This does not make arbitrary legacy keys or CI project tokens public. A key prefix alone does not establish its scope. Project tokens for deployments and source maps are not telemetry credentials.

Server configuration belongs in the application's existing environment or secret configuration. Tracked `.env.example` values stay empty. A browser bundle uses only a connection approved for browser use, with website restrictions configured on the service. Never move a legacy full-access key or CI token into a frontend.

Browser origin restrictions limit browser ingestion. They are not proof of a trusted client outside a browser. The application must not forge an `Origin` header to change server telemetry into browser telemetry.

`mk_test_` is a recognized key format, not an accepted-and-discarded sentinel. No `MONOCLE_TEST` equivalent to `MAPLE_TEST` is defined by this contract.

## Rejection and acceptance

Authentication failures return a generic `401`. Possible causes include the key, service, environment, origin restrictions, or account eligibility. Some authorization decisions are cached for up to five minutes. New connections do not create services during ingestion. Legacy name-based routing is a compatibility path, not the onboarding default.

HTTP acceptance is not proof of storage. The telemetry budget can cause billable data to be acknowledged and discarded. Some metric names are filtered by the collector. OTLP responses can also report partial success. End-to-end verification must locate the expected records in Monocle.

## Sources

- [Any OpenTelemetry SDK](https://monocle.sh/docs/opentelemetry/any-sdk)
- [Core concepts](https://monocle.sh/docs/concepts)
- [Troubleshooting](https://monocle.sh/docs/troubleshooting)
- [OTLP exporter configuration](https://opentelemetry.io/docs/languages/sdk-configuration/otlp-exporter/)
