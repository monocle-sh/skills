# Handle sensitive telemetry

## Preserve diagnostics

Keep ordinary application logs, structured business fields, correlation IDs such as `x-request-id`, and standard error details. Neither an identifier nor an `err` key proves sensitive content. Error messages can contain secrets, so inspect the actual logger calls, serializers, and SDK behavior before deciding.

When a concrete field contains credentials or disallowed personal data, redact that field before export through existing logger or SDK controls. Preserve other diagnostics and native correlation. Do not add global field allowlists, custom processors, or blanket header removal to guard against hypothetical leaks.

Never export credentials. If supported controls cannot resolve an observed exposure, keep the affected export inactive and report the missing coverage and next action. Do not silently disable the whole logger bridge or claim completion.

## Bound optional capture

Arbitrary HTTP body or header capture, cookies, command arguments, and AI content are outside default onboarding. Existing correlation metadata is not a request to collect all headers.

For an explicit content-capture request:

1. Agree on the diagnostic purpose, routes, and fields. Exclude credentials, authorization headers, payment details, and other disallowed content.
2. Set size limits and supported content types. Skip binary, multipart, streaming, and oversized payloads.
3. Use native capture and pre-export redaction. Do not consume request streams or buffer responses to recreate an SDK feature.
4. Obtain approval before enabling capture. Developer approval does not replace visitor consent for replay.
5. Test synthetic allowed and excluded values through the exporter. Confirm unchanged application behavior. Document how to disable capture.

For AI integrations, inspect defaults and disable prompt, completion, tool-argument, and tool-result capture. Model names, timing, errors, and token counts need no conversation content.

## Limit identity

Error coverage with existing authentication uses the stable internal ID, email, and name when available. Respect identity opt-outs and project restrictions. Omit unavailable or excluded fields. Do not use email as the stable ID or pass entire user objects. Other profile fields and replay identity need separate approval. IDs, emails, and names are personal data. Analytics-only setup adds no identity hook.

Sources: [user attribution](https://monocle.sh/docs/frameworks/adonisjs/users-and-exceptions), [HTTP capture](https://monocle.sh/docs/frameworks/adonisjs/http), [browser privacy](https://monocle.sh/docs/sdks/browser), and [semantic conventions](https://monocle.sh/docs/opentelemetry/semantic-conventions).
