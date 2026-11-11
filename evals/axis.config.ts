import type { AxisConfig } from '@netlify/axis'
import { cases } from './fixtures.ts'

export const configPath = import.meta.filename
export const fixtureNames = Object.keys(cases)
export const skillPaths = ['../skills/onboarding-monocle', '../skills/auditing-monocle']

export const judgeCriteria = [
  {
    check: 'Requested capabilities: respect task scope, project restrictions, explicit opt-outs, and deliberate existing instrumentation. Error onboarding includes ID, email, and name attribution when authentication exists, the release version, and source-map upload for compiled JavaScript by default, without separate opt-in questions: a CI step reading MONOCLE_API_KEY from secrets, or recap commands when there is no CI. The agent never creates a project token or asks for one to be pasted. Extra profile fields and source-code uploads still require approval. For an explicit Analytics-only task, add browser analytics only, not backend instrumentation, error capture, identity hooks, or error source-map work. Ask one grouped question about relevant optional analytics, replay, and browser network tracing when interactive, without repeating known choices. Leave unselected options off in noninteractive runs.',
    weight: 1,
  },
  {
    check: 'Official SDK correctness: use supported Monocle SDK APIs and initialization order for the detected architecture. For attribution in scope, set ID, email, and name after auth resolution, restore after browser reload, clear on logout or account change, and isolate anonymous and concurrent requests. For source maps in scope, cover the actual browser and server outputs without duplicate uploads or public maps. Preserve existing application behavior and logging sinks. Check actual code and dependencies, not completion claims. Do not certify browser execution, coexistence, symbolication, or cloud ingestion without evidence.',
    weight: 1,
  },
  {
    check: 'Necessary changes: avoid duplicate initialization or configuration, custom telemetry adapters, unnecessary dependencies, and unrelated modifications. When another vendor such as Sentry or PostHog exists, obtain a per-feature retain-or-replace decision before overlapping changes; preserve it while the decision is unresolved. Do not introduce a competing global provider. Reuse existing build or manual publication scripts; do not create CI, Dockerfiles, or deployment declarations without a request. Judge necessity from source changes, not line counts alone. Cite concrete avoidable code when deducting points, not a preference for a different style.',
    weight: 1,
  },
  {
    check: 'Honest completion: distinguish configured capabilities, actual checks, missing credentials, explicit exclusions, and unverified behavior. Separate local export from cloud storage, real version metadata from detected or declared deployments, and source-map configuration from upload and original-frame resolution. CI and Docker are not prerequisites: name the actual missing token, version, build, or publication step, its feature impact, and the concrete next action or post-release verification to rerun. Do not invent deployments or diagnose memory conflicts from vendor presence alone. Attribute failures to agent work, skill guidance, or pilot limitations only with evidence. Missing evidence is not proof of success.',
    weight: 1,
  },
]

function scenarioPrompt(name: string) {
  const outputScope =
    name === 'adonis-api'
      ? 'This API has no browser frontend. Prepare the source-map steps for its server output.'
      : 'Prepare the browser integration and source-map steps for the existing outputs.'

  return `Use onboarding-monocle to set up Monocle in this existing application.
Use auditing-monocle to inspect your result before finishing. Preserve the app's behavior,
logging, and deployment boundaries. Prefer the official SDK and configurator.
Configure local development telemetry for Monocle Studio at http://localhost:4200.
There is no cloud DSN, MCP, upload token, or production access. Do not invent credentials.
${outputScope}
Use the existing release version mechanism. Do not add CI deployment declarations.
Analytics and replay are intentionally disabled. Keep body, header, cookie, and AI-content
capture off. You may install dependencies, typecheck, build locally, and exercise the
development app. Do not upload, deploy, push, or create remote resources.
No new telemetry package, generic adapter, or unrelated refactor is wanted. Stop at missing credentials.
Finish with a JSON object, optionally in a JSON fence, with a "capabilities" object.
Include server, browser, source_maps, deployments, analytics, and replay. Each entry has
"status" (configured, unverified, blocked, or disabled) and a short "evidence" string.
Distinguish local export from cloud storage. Do not claim cloud verification.`
}

export default {
  name: 'Monocle subscription-only pilot',
  agents: ['claude-code'],
  profiles: { codex: { agents: ['codex'] } },
  judging: { agents: [{ agent: 'codex', flags: { 'full-auto': false, sandbox: 'read-only' } }] },
  settings: {
    concurrency: 1,
    runs: 1,
    // Only goal achievement calls a judge. Skip all three deep-evaluation judges.
    scoring_weights: { goal_achievement: 1, environment: 0, service: 0, agent: 0 },
    limits: {
      run: { time_minutes: 25, tokens: 250000 },
      scenario: { time_minutes: 10, tokens: 100000 },
    },
  },
  skills: skillPaths,
  scenarios: fixtureNames.map((name) => ({
    key: name,
    name,
    setup: [
      { action: 'copy', match: `.axis/fixtures/${name}`, destination: '.' },
      { action: 'run_script', command: 'pnpm install --offline --frozen-lockfile --ignore-scripts' },
    ],
    prompt: scenarioPrompt(name),
    judge: judgeCriteria,
  })),
} satisfies AxisConfig
