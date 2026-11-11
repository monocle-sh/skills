# Prepare and run the subscription-only pilot

This pilot runs the existing Monocle skills against two pinned AdonisJS 7 applications. It uses AXIS 1.21.0 for agent execution and reports. Deterministic local checks run independently of optional LLM scoring.

The default command prints a plan. It does not invoke Claude, Codex, login commands, or a model.

## Prepare without running agents

Use Node.js 24 or later and pnpm 10.34.6. Run these commands from `evals/`:

```sh
npm ci --ignore-scripts
npm run fixtures
npm run check
npm run plan
```

Fixture preparation downloads public source, installs pinned dependencies with lifecycle scripts disabled, and populates a local pnpm store. It does not build applications, upload telemetry, read agent credentials, or start agents. The first preparation needs network access. Subsequent fixture installations use the checked-in lockfiles. Do not regenerate lockfiles to compare skill revisions.

The generated fixtures and reports stay under ignored `.axis/`. Preparation replaces only `.axis/fixtures/` and `.axis/proto/`, not previous reports. Skills are read from this checkout without installing them into your personal agent configuration.

## Review the two cases

Both fixtures come from [adonisjs/starter-kits](https://github.com/adonisjs/starter-kits/tree/46d235932e3eb6472a16b740fa0b47b5f69fc6fc).

| Case | Starting application | Delivery boundary |
| --- | --- | --- |
| `adonis-monorepo` | Official API monorepo, with its empty frontend filled by a small React and Vite application | Separate backend and frontend deployments |
| `adonis-inertia` | Official React Inertia starter, with SSR disabled as upstream configures it | One Adonis deployment including browser assets |

The existing auth, SQLite configuration, logging, and application routes remain. Each backend gets an order route and a failure route for local checks. There is no installed Monocle provider initially. The monorepo pilot has no worker or shared package yet. Those are later conditions, not coverage claimed by this first pair of runs.

The task asks for local Studio instrumentation and preparation of the browser and source-map setup. No cloud DSN, MCP, upload token, or deployment token is available. Analytics and replay must remain disabled. A missing cloud credential must be reported, not invented.

## Run later with an existing subscription

Do not run this section as part of preparation.

Use a disposable machine or container that contains only the permitted subscription login. The AXIS native adapters disable tool-approval and sandbox safeguards by default. A temporary workspace is not a security sandbox. The pilot does not isolate the host or restrict network egress.

1. Authenticate the native Claude Code or Codex CLI using your subscription account on that machine.
2. Disable paid extra usage, credit auto-top-ups, and other overage options in the provider account. Confirm the available quota.
3. Leave port 4200 free. The pilot uses it for a loopback OTLP receiver in place of Studio. It exits if the port is occupied and does not stop an existing Studio process.
4. Select one case for the first execution.

For Claude Code:

```sh
npm run pilot -- --execute --agent claude-code --scenario adonis-inertia \
  --confirm-extra-usage-disabled --confirm-isolated-environment
```

For Codex:

```sh
npm run pilot -- --execute --agent codex --scenario adonis-inertia \
  --confirm-extra-usage-disabled --confirm-isolated-environment
```

Omit `--scenario` to select both cases. There is one execution per case, sequentially. Agent work is limited to 10 minutes and an estimated 100,000 tokens per case. The overall AXIS agent budget is 25 minutes and an estimated 250,000 tokens. Token limits are streaming estimates, not exact billing caps. Runtime checks run after agent work and have their own readiness and request timeouts.

The launcher removes inherited API keys, gateways, provider variables, Node hooks, and project secrets before AXIS runs. It checks the CLI login method and rejects API authentication. Only the native `claude-code` and `codex` adapters are accepted. No SDK adapter, alternate provider, or automatic scenario retry is configured. Model judging is off unless you explicitly pass `--judge`. The run stops after a failed case. The native CLIs can still perform their own transient request retries.

The account-side overage setting cannot be verified by this launcher. The confirmation flag is an acknowledgement, not a technical spending cap. Subscription usage still consumes quota. Do not treat an estimated dollar amount in a CLI transcript as an additional API invoice.

If the account owner explicitly authorizes paid subscription extra usage for the selected run, use `--allow-subscription-extra-usage` instead of `--confirm-extra-usage-disabled`. This records permission, not a claim about account settings or a spending cap. Isolation and subscription authentication remain required. API authentication is still rejected. Actual charges require account billing evidence, not a token-price estimate.

AXIS currently expects Codex's local `auth.json` for session propagation. A keychain-only Codex login needs a compatible file-backed login on the disposable execution machine. Claude's adapter supports its local credential file and macOS Keychain. The pilot does not copy credentials into reports or fixtures. Never share an AXIS temporary home or an account credential file.

## Prepare the optional native judge

Inspect the judge plan without running a model or reading a login:

```sh
npm run plan -- --judge --agent codex --scenario adonis-inertia
```

The judge uses AXIS's native `scoreRunResult` and four equally weighted criteria in `axis.config.mjs`:

1. Respect the requested capabilities without additional collection.
2. Use the official SDKs correctly for the existing application.
3. Avoid unnecessary code, dependencies, duplicate configuration, and unrelated changes.
4. Report configuration, actual verification, and blockers honestly.

The criteria follow onboarding defaults: ID-only attribution with authenticated error coverage and source-map preparation for compiled JavaScript. They also check relevant grouped questions, per-feature vendor coexistence decisions, and actionable publication blockers without requiring CI or Docker. Explicit task restrictions win over defaults. The current pilot prompt explicitly disables identity and forbids builds, uploads, and deployment declarations; judging must not penalize respecting those restrictions. These two fixtures do not certify interactive question handling, default identity wiring, or vendor coexistence.

If you later authorize execution, add `--judge` to the guarded Codex pilot command above. It requires one explicit `--scenario`. It runs the application agent once, then at most one fresh Codex judge invocation in the same isolated machine or container. This is not permission to rerun a previously authorized case. It does not score historical reports. Only goal achievement has nonzero scoring weight, so AXIS skips its three deep-evaluation judges. The same provider judges the result; this is not an independent-model assessment.

The judge runs before workspace cleanup. It receives the condensed transcript, final completion, criteria, and paths to the source changes and deterministic evidence. It is instructed to read only, cite evidence for deductions, and distinguish an agent error from a skill defect or pilot limitation. Missing evidence does not certify an integration. The transcript can be truncated by AXIS; the judge can inspect local files for additional context.

The four grades use AXIS's 0 to 10 scale. Their equal-weight average becomes the goal score out of 100 and the composite score. The other three dimension scores are AXIS defaults with zero weight, not measured grades. There is no quality pass threshold yet. A high judge score cannot override failed HTTP or telemetry checks. An unusable judge response is recorded as `withheld`, not a measured zero, and causes a nonzero pilot exit. An agent execution failure skips the model judge. No pilot scoring retry is configured.

Use only `pilot.mjs` to execute this pilot. Direct `axis run` or scoring calls bypass its billing, authentication, and environment guards. In AXIS 1.21.0, the native judge path does not apply the runner's remapped HOME or adapter isolation variables. It inherits the launcher's scrubbed environment and reads the permitted Codex login from that process's HOME. Therefore that HOME must belong to the disposable execution environment and contain only the authorized session, not your Mac's normal configuration.

The judge disables AXIS's sandbox bypass and requests Codex's `--sandbox read-only`. The preparation test verifies the generated command and environment using a fake executable. It does not verify real Codex authentication, token refresh, or sandbox enforcement. Keep the actual machine or container isolation requirement even with this flag. Do not mount your normal home, other credentials, or a Docker socket.

The native judge has a separate 10-minute adapter timeout. AXIS does not forward the runner's token limit or cancellation signal to it. Interrupting the launcher does not guarantee an active judge stops; stop the disposable container if needed. One invocation can contain multiple provider requests or CLI retries. Judge usage consumes subscription quota, and AXIS does not preserve judge token or billing metadata here. The launcher cannot certify an extra-usage setting or an actual charge. Validate the real subscription path inside the authorized container before any future model execution.

## Read the evidence

Each executed run writes an AXIS report and a separate `pilot.json` under `.axis/reports/`. The latter records deterministic checks and optional judge status separately. AXIS's unscored completion summary only describes agent execution. With judging enabled, the AXIS report also includes per-criterion grades and rationales, a transcript index, and transcript analysis. Review these alongside `changes.json` and `verification.json`. A judge outage does not rewrite the original agent-success check in the pilot evidence.

The automated checks cover:

- The order response and HTTP 500 behavior remain intact.
- The existing stdout logger still emits the order log.
- Exactly one server span describes the exercised order request.
- The order log has the same trace ID as that request.
- The final completion report explicitly accounts for server, browser, source maps, deployments, analytics, and replay.

The receiver uses pinned [OpenTelemetry protobuf definitions](https://github.com/open-telemetry/opentelemetry-proto/tree/a8951735f7801e8adfaec5c0ace9262771cfec6e). It decodes local HTTP OTLP JSON and protobuf, including gzip. It is not a Monocle authentication, storage, or symbolication service.

Each case also records the source changes, added direct dependencies, changed production-file count, and net production-line delta. JSON configuration, Markdown, lockfiles, generated output, and dependencies are excluded from production-line counters but remain available in source changes where applicable. These counters do not decide whether code is necessary. Review the changes for duplicate initialization, adapter packages, unrelated refactors, and avoidable configuration.

The completion report checks explicit dispositions, not whether every claim is true. Review claims against runtime evidence. Browser execution, privacy and consent behavior, source-map build and upload, resolved original frames, database instrumentation, shutdown export, and deployment version detection are not certified by this pilot. `fullIntegrationVerified` remains false even when its automated checks pass. Do not use it as a public compatibility or release certification.

Reports can contain app source and agent transcripts. Review them before sharing. The provided fixtures use synthetic data only.

## Check the preparation

`npm run check` makes no model calls. It checks plan-only execution, launch guards, subscription-auth rejection, credential filtering, omitted completion items, change reporting, and telemetry negative controls. A fake Codex executable exercises the native AXIS judge path with synthetic transcripts and grades. It checks one-invocation scoring, command flags, inherited scrubbed environment, withheld grades without retries, and unchanged agent evidence. It never reads a real login or evaluates an application. After fixture preparation the tests also exercise the receiver with independent gzip protobuf bytes and an OTLP JSON log. Without the downloaded schemas, that receiver test is explicitly skipped.

The preparation was checked without any Claude or Codex execution. Both fixture typechecks passed. Both uninstrumented backends served the order and failure requests and kept their stdout logs. Their telemetry checks failed with zero spans, as the negative control requires. No browser rendering, production build, source-map upload, cloud ingestion, or subscription refresh was tested.
