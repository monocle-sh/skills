# Write the team recap

The final reply carries the full report. The recap is for a developer who did not see the session. It answers three questions: what runs now, what the team must still do, and how to change the optional features.

## Place it

Add a short `Monocle` section to the project's existing README or deployment document. If neither fits, create `MONOCLE.md` at the root of the application. Write one recap per repository. In a monorepo, give each deployed service one line or one short subsection.

## Write it

- Stay under 30 lines, counting the section heading and blank lines. Count them with `wc -l` before you finish. Cut detail rather than exceed the limit.
- Write short, active sentences with one idea each. Name who does what: "the Vite plugin uploads browser maps".
- Give exact variable names, commands, and file paths. Link Monocle's documentation instead of repeating it.
- State each missing step once, with the feature it unlocks.
- Leave out check IDs, test logs, audit evidence, lists of unverified behavior, SDK internals, and anything the code already shows.
- Do not hedge or add filler such as "note that", "make sure to", or "it is important to".

## Example

This recap covers an AdonisJS and Inertia application with one Monocle service:

~~~markdown
## Monocle

The AdonisJS agent sends server traces, logs, metrics, and errors. The browser SDK sends frontend errors. Logged-in users appear on errors with their ID, email, and name.

In development, telemetry goes to Monocle Studio at http://localhost:4200.

### Before the first deployment

- Set `MONOCLE_DSN` and `VITE_MONOCLE_DSN` to the DSN from the service's **SDK connection** page.
- Set `MONOCLE_API_KEY` in the build environment to upload source maps. `pnpm build` then uploads browser maps. Upload server maps after the build:

  ```sh
  pnpm exec monocle sourcemaps inject ./build
  pnpm exec monocle sourcemaps upload ./build
  ```

- Keep `GITHUB_SHA` or `MONOCLE_VERSION` available at build and run time. Monocle uses it to detect deployments.

### Optional features

Analytics, session replay, and browser network tracing are off. See https://monocle.sh/docs/sdks/browser to enable them.
~~~
