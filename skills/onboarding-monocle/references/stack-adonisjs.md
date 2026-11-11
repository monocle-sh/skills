# Configure AdonisJS

## Install the agent

Run `node ace add @monocle.sh/adonisjs-agent` and review its changes. Keep the generated `otel.ts` imports, provider, middleware, and `config/monocle.ts`.

- The configurator already declares `APP_ENV` and `MONOCLE_DSN` in `.env`, `.env.example`, and `start/env.ts`. Do not add them again.
- The agent covers HTTP, database, Pino logs, exceptions, and jobs. Do not add other OpenTelemetry packages for them.
- Do not add `serviceName`. Monocle Cloud takes the service name from the DSN.
- Keep `monocle_middleware` first in `router.use`, before body parsing, session, and authentication.
- Keep the Pino instrumentation enabled unless the user excludes it.
- In development, the agent sends to Monocle Studio at `http://localhost:4200` without credentials. Keep that default.

## Attribute users

Call `Monocle.setUser` after authentication resolves. This call is required: the agent's automatic user context runs inside `monocle_middleware`, before authentication, so it never sees the user on protected routes.

```ts
import { Monocle } from '@monocle.sh/adonisjs-agent'

// In app/middleware/auth_middleware.ts, after authenticateUsing(),
// and in silent_auth_middleware.ts after auth.check() when a user exists.
const user = ctx.auth.user!
Monocle.setUser({ id: String(user.id), email: user.email, name: user.fullName ?? undefined })
```

Map the real model fields. Do not pass the whole user object. Do not add `userContext: false` or a custom resolver to use `setUser`. For an identity opt-out, set `userContext: false` and add no `setUser` call.

## Set the release version

The agent reads `MONOCLE_VERSION`, then hosting variables such as `VERCEL_GIT_COMMIT_SHA`. It reads CI variables only while running in that CI: `GITHUB_SHA` counts only when `GITHUB_ACTIONS` is set. When the runtime receives the release under another name, pass it in `config/monocle.ts`:

```ts
serviceVersion: process.env.GITHUB_SHA,
```

## Prepare source maps

The AdonisJS TypeScript preset already enables `sourceMap`, so `node ace build` writes server maps to `build/`. Inject and upload them as described in [javascript-source-maps.md](javascript-source-maps.md).

With Inertia, the Vite plugin handles the browser output. It deletes the maps it enabled, so the `build/public` copy holds none unless the project sets `build.sourcemap`. Run the CLI on `build/` without moving or excluding directories.

## Keep body capture off

If an explicit option stays in `config/monocle.ts`, explain it:

```ts
http: {
  /**
   * Payload capture increases telemetry volume and quota usage.
   * Bodies can contain personal data or secrets.
   * @see https://monocle.sh/docs/frameworks/adonisjs/http
   */
  captureBodies: false,
},
```

## Verify

Check that `monocle_middleware` runs first, and exercise an early body-parser or authentication rejection. For an authorized cloud check, set `MONOCLE_DEV=false` temporarily and keep the environment `development`.

## Sources

- [AdonisJS setup](https://monocle.sh/docs/frameworks/adonisjs)
- [AdonisJS configuration](https://monocle.sh/docs/frameworks/adonisjs/configuration)
- [Users and exceptions](https://monocle.sh/docs/frameworks/adonisjs/users-and-exceptions)
- [HTTP capture](https://monocle.sh/docs/frameworks/adonisjs/http)
