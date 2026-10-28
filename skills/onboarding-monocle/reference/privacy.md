# Configure optional sensitive capture

Use this procedure only when the user explicitly requests sensitive content capture. Default onboarding does not collect HTTP bodies, headers, cookies, command arguments, or AI content.

1. Name the exact diagnostic purpose and the endpoints or operations involved.
2. Propose an allowlist of fields and routes. Exclude authentication, payments, file uploads, tokens, passwords, cookies, and authorization headers.
3. Set a maximum captured size and supported content types. Skip binary, multipart, streaming, and oversized payloads.
4. Redact before export. Do not rely on downstream grouping or UI hiding to remove sensitive data.
5. Use an existing SDK capture feature when available. Do not consume a request stream or buffer a response solely to recreate a full SDK feature.
6. Ask for approval of this capture policy before enabling it. Keep the rest of onboarding independent of the answer.
7. Test synthetic allowed and denied payloads. Confirm that handlers still receive their original request data, responses are unchanged, and excluded values never reach the exporter.
8. Document how to disable capture. Do not change production configuration or deploy it without authorization.

For user attribution, an approved opaque user ID is sufficient. Email and display name need their own justification. Preserve logout behavior and concurrent-request isolation. An opaque ID may still be personal data.

For AI instrumentation, inspect package defaults. Disable prompt, completion, tool-argument, and tool-result capture before enabling it. Timing, model names, errors, and token counts do not require conversation content.

Sources: [HTTP instrumentation](https://monocle.sh/docs/frameworks/adonisjs/http), [browser privacy](https://monocle.sh/docs/sdks/browser), and [semantic conventions](https://monocle.sh/docs/opentelemetry/semantic-conventions).
