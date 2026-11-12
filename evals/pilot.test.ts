import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { gzipSync } from 'node:zlib'
import type { RunResult } from '@netlify/axis'
import config, { configPath, judgeCriteria } from './axis.config.ts'
import { options, plan, scorePilotResult } from './pilot.ts'
import { createReceiver, telemetryChecks, type KeyValue, type LogRecord, type Span } from './receiver.ts'
import { assertSubscription, cleanEnvironment } from './subscription.ts'
import { compareChanges, completionChecks } from './verify.ts'

function replaceEnvironment(env: NodeJS.ProcessEnv) {
  for (const name of Object.keys(process.env)) delete process.env[name]
  Object.assign(process.env, env)
}

const root = import.meta.dirname
const capabilities = ['server', 'browser', 'source_maps', 'deployments', 'analytics', 'replay']

function planOnly(args: string[]) {
  return spawnSync(process.execPath, ['pilot.ts', ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { PATH: '/no-agent-executables' },
  })
}

test('default plan and rejected executions do not start an agent or read its login', () => {
  const result = planOnly([])
  assert.equal(result.status, 0, result.stderr)
  assert.equal(JSON.parse(result.stdout).mode, 'plan-only')
  assert.equal(plan(options([])).modelJudges, 0)

  assert.throws(() => options(['--execute']), /requires confirmation/)
  assert.throws(() => options(['--execute', '--confirm-isolated-environment']), /requires confirmation/)
  assert.throws(() => options(['--execute', '--allow-subscription-extra-usage']), /requires confirmation/)
  assert.doesNotThrow(() => options(['--execute', '--confirm-isolated-environment', '--confirm-extra-usage-disabled']))

  const authorized = options([
    '--execute',
    '--agent',
    'codex',
    '--scenario',
    'adonis-inertia',
    '--confirm-isolated-environment',
    '--allow-subscription-extra-usage',
  ])
  assert.equal(authorized['confirm-extra-usage-disabled'], false)
  assert.match(plan(authorized).billing, /extra usage explicitly authorized/)

  assert.throws(() => options(['--agent', 'claude-sdk']), /Only claude-code and codex/)
  assert.throws(() => options(['--scenario', 'typo']), /Unknown scenario/)
})

test('judge planning is opt-in, single-case Codex only, and retains execution guards', () => {
  const args = ['--judge', '--agent', 'codex', '--scenario', 'adonis-inertia']

  const result = planOnly(args)
  assert.equal(result.status, 0, result.stderr)

  const proposed = JSON.parse(result.stdout)
  assert.equal(proposed.mode, 'plan-only')
  assert.equal(proposed.modelJudges, 1)
  assert.equal(proposed.judging.criteria.length, 4)
  assert.deepEqual(proposed.judging.weights, { goal_achievement: 1, environment: 0, service: 0, agent: 0 })

  assert.throws(() => options(['--judge', '--agent', 'codex']), /one explicit/)
  assert.throws(() => options(['--judge', '--scenario', 'adonis-inertia']), /--agent codex/)
  assert.throws(() => options([...args, '--execute']), /requires confirmation/)
  assert.throws(() => options([...args, '--execute', '--confirm-isolated-environment']), /requires confirmation/)
  assert.throws(() => options([...args, '--execute', '--confirm-extra-usage-disabled']), /requires confirmation/)
  assert.doesNotThrow(() =>
    options([...args, '--execute', '--confirm-isolated-environment', '--confirm-extra-usage-disabled']),
  )
})

// This executable is a protocol stub, not Codex. No real login or model is used.
const fakeCodex = `#!${process.execPath}
import { appendFileSync } from 'node:fs'
if (process.argv.includes('--version')) process.exit(0)
let prompt = ''
for await (const chunk of process.stdin) prompt += chunk
appendFileSync('judge-requests.ndjson', JSON.stringify({ args: process.argv.slice(2), env: process.env, prompt }) + '\\n')
const text = prompt.includes('TEST_UNPARSEABLE') ? 'not a grade' : JSON.stringify({ grades: [
  { criterion_index: 0, score: 10, rationale: 'Synthetic scope evidence' },
  { criterion_index: 1, score: 6, rationale: 'Synthetic SDK evidence' },
  { criterion_index: 2, score: 2, rationale: 'Synthetic unnecessary code evidence' },
  { criterion_index: 3, score: 8, rationale: 'Synthetic completion evidence' },
] })
console.log(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text } }))
`

test('native AXIS scoring uses one fake Codex process and withholds unusable grades without altering agent evidence', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'monocle-judge-test-'))
  const home = join(directory, 'empty-home')
  const workspace = join(directory, 'work')
  mkdirSync(home)
  mkdirSync(workspace)
  writeFileSync(join(directory, 'codex'), fakeCodex, { mode: 0o700 })

  // Mutate process.env in place, like the pilot does: Node 26 child processes ignore a replaced object.
  const previousEnv = { ...process.env }
  replaceEnvironment(cleanEnvironment({ PATH: directory, HOME: home, OPENAI_API_KEY: 'not-a-real-key', NODE_OPTIONS: '--invalid' }))

  try {
    const { loadConfig, discoverScenarios } = await import('@netlify/axis')
    const loaded = await loadConfig(configPath, { profile: 'codex' })
    const scenarios = await discoverScenarios(root, loaded.config.scenarios, ['adonis-inertia'])
    assert.equal(scenarios.length, 1)
    assert.deepEqual(scenarios[0].judge, judgeCriteria)
    assert.deepEqual(loaded.config.judging, config.judging)

    const timestamp = '2026-01-01T00:00:00.000Z'
    const result: RunResult = {
      scenarioKey: 'adonis-inertia',
      scenarioName: 'Synthetic case',
      agentName: 'codex',
      agentConfig: { agent: 'codex' },
      judge: scenarios[0].judge,
      workingDirectory: workspace,
      prompt: 'Synthetic integration task. No actual command was run.',
      output: {
        result: 'Synthetic completion',
        transcript: [
          { type: 'tool_use', timestamp, content: { type: 'command_execution', command: 'curl https://example.invalid' } },
          { type: 'tool_result', timestamp, content: { type: 'command_execution', output: 'Synthetic response' } },
          { type: 'assistant', timestamp, content: { type: 'agent_message', text: 'Synthetic completion' } },
        ],
        metadata: { startTime: timestamp, endTime: timestamp, durationMs: 1, exitCode: 0 },
      },
    }
    const original = structuredClone(result)
    const paths = { reportDir: join(directory, 'report'), evidenceDir: join(directory, 'evidence') }

    const scored = await scorePilotResult(result, paths)
    assert.equal(scored.score.goalAchievement.score, 65)
    assert.equal(scored.score.axisScore, 65)
    assert.deepEqual(scored.score.goalAchievement.criteria.map(({ score }) => score), [10, 6, 2, 8])
    assert.deepEqual(result, original)

    // All three categories must be present so default deep-eval weights would call extra judges.
    for (const category of ['environment', 'service', 'agent'] as const) {
      assert.ok(scored.score.sparseIndex!.stats.byCategory[category] > 0, category)
    }
    assert.ok(existsSync(join(paths.reportDir, 'scenarios/adonis-inertia/codex.sparse-index.txt')))

    const requests = () =>
      readFileSync(join(workspace, 'judge-requests.ndjson'), 'utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
    assert.equal(requests().length, 1)

    const request = requests()[0]
    assert.deepEqual(request.args, ['exec', '--json', '--skip-git-repo-check', '--sandbox', 'read-only'])
    assert.equal(request.env.HOME, home)
    assert.equal(request.env.CODEX_HOME, undefined)
    assert.equal(request.env.OPENAI_API_KEY, undefined)
    assert.equal(request.env.NODE_OPTIONS, undefined)
    assert.ok(request.prompt.includes(paths.evidenceDir))
    for (const { check } of judgeCriteria) assert.ok(request.prompt.includes(check))

    const unusable = { ...result, prompt: 'TEST_UNPARSEABLE' }
    const withheld = await scorePilotResult(unusable, paths)
    assert.equal(withheld.score.withheld, true)
    assert.match(withheld.output.metadata.error ?? '', /Score withheld/)
    assert.equal(unusable.output.metadata.error, undefined)
    assert.equal(requests().length, 2, 'A parse failure must not trigger a retry')

    const failedAgent = structuredClone(result)
    failedAgent.output.metadata.error = 'Synthetic agent failure'
    const failed = await scorePilotResult(failedAgent, paths)
    assert.equal(failed.score.goalAchievement.score, 0)
    assert.equal(failed.score.withheld, undefined)
    assert.equal(requests().length, 2, 'Failed agents must not consume a judge invocation')
  } finally {
    replaceEnvironment(previousEnv)
    rmSync(directory, { recursive: true, force: true })
  }
})

test('subscription environment removes API credentials, gateways, and inherited node hooks', () => {
  const environment = cleanEnvironment({
    PATH: '/bin',
    HOME: '/home/test',
    ANTHROPIC_API_KEY: 'test-only',
    CODEX_API_KEY: 'test-only',
    OPENAI_API_KEY: 'test-only',
    ANTHROPIC_BASE_URL: 'https://example.invalid',
    CLAUDE_CODE_OAUTH_TOKEN: 'test-only',
    AWS_PROFILE: 'test',
    NODE_OPTIONS: '--import=untrusted',
  })

  assert.deepEqual(environment, { PATH: '/bin', HOME: '/home/test' })
})

test('auth preflight accepts subscription sessions but rejects API auth, failed login, and unknown providers', () => {
  const execute = (stdout: string, stderr = '', status = 0) => () => ({ stdout, stderr, status })
  const claudeStatus = (authMethod: string) => execute(JSON.stringify({ loggedIn: true, authMethod }))

  assertSubscription({ agent: 'claude-code', env: {}, execute: claudeStatus('claude.ai') })
  assertSubscription({ agent: 'codex', env: {}, execute: execute('', 'Logged in using ChatGPT') })

  assert.throws(() => assertSubscription({ agent: 'claude-code', env: {}, execute: claudeStatus('api_key') }), /subscription/)
  assert.throws(
    () => assertSubscription({ agent: 'codex', env: {}, execute: execute('', 'Logged in using an API key') }),
    /ChatGPT/,
  )
  assert.throws(() => assertSubscription({ agent: 'codex', env: {}, execute: execute('', '', 1) }), /No usable/)
  assert.throws(
    () => assertSubscription({ agent: 'gemini', env: {}, execute: () => assert.fail('must not spawn') }),
    /Only/,
  )
})

test('completion checks detect an omitted source-map disposition and unrequested replay', () => {
  const reported: Record<string, { status: string; evidence: string }> = Object.fromEntries(
    capabilities.map((name) => [
      name,
      {
        status: ['analytics', 'replay'].includes(name) ? 'disabled' : 'unverified',
        evidence: 'Not exercised in this local run.',
      },
    ]),
  )
  assert.ok(completionChecks(JSON.stringify({ capabilities: reported })).every(({ pass }) => pass))

  delete reported.source_maps
  reported.replay.status = 'configured'

  const failed = completionChecks(JSON.stringify({ capabilities: reported }))
    .filter(({ pass }) => !pass)
    .map(({ check }) => check)
  assert.deepEqual(failed, ['Explicit disposition for source_maps', 'Explicit disposition for replay'])
})

test('change report includes added, modified, deleted files and direct dependencies', () => {
  const result = compareChanges({
    before: { 'package.json': '{"dependencies":{"existing":"1"}}', 'app.ts': 'before', 'removed.ts': 'old' },
    after: {
      'package.json': '{"dependencies":{"existing":"2","unnecessary-adapter":"1"}}',
      'app.ts': 'after',
      'new.ts': 'added\nsecond line',
    },
  })

  assert.equal(result.changes.length, 4)
  assert.equal(result.productionFilesChanged, 3)
  assert.equal(result.productionLinesDelta, 1)
  assert.deepEqual(result.dependencies.map(({ name }) => name), ['unnecessary-adapter'])
})

test('runtime checks reject absent, duplicate, and wrong-kind spans and unrelated log contexts', () => {
  const span: Span = {
    kind: 2,
    traceId: 'trace-a',
    attributes: [{ key: 'url.path', value: { stringValue: '/pilot/orders/order-51' } }],
  }
  const log: LogRecord = { traceId: 'trace-a', body: { stringValue: 'pilot-order' } }
  const spans = [span]
  const packets = [
    { data: { resourceSpans: [{ scopeSpans: [{ spans }] }] } },
    { data: { resourceLogs: [{ scopeLogs: [{ logRecords: [log] }] }] } },
  ]
  const checks = () => telemetryChecks({ packets, orderId: 'order-51' })

  assert.ok(checks().slice(0, 2).every(({ pass }) => pass))

  log.traceId = 'trace-b'
  assert.equal(checks()[1].pass, false)

  spans.push(span)
  assert.equal(checks()[0].pass, false)

  span.kind = 3
  assert.equal(checks()[0].observed, 0)

  assert.ok(telemetryChecks({ packets: [], orderId: 'order-51' }).every(({ pass }) => !pass))
})

test('runtime checks require the release, the user on authenticated work, and one report per failure', () => {
  const string = (key: string, value: string): KeyValue => ({ key, value: { stringValue: value } })
  const server = (traceId: string, path: string, extra: KeyValue[] = []) => ({
    kind: 2,
    traceId,
    attributes: [string('url.path', path), ...extra],
    events: [] as { name: string; attributes: KeyValue[] }[],
  })
  const report = (traceId: string, message: string, extra: KeyValue[] = []) => ({
    traceId,
    attributes: [string('monocle.log.source', 'exception_reporter'), string('exception.message', message), ...extra],
  })

  const order = server('t-order', '/pilot/orders/o-1')
  const account = server('t-account', '/pilot/account/orders/o-2', [{ key: 'user.id', value: { intValue: '7' } }])
  const anonymous = server('t-anon', '/pilot/failure')
  const failing = server('t-auth', '/pilot/account/failure', [string('user.id', '7')])

  const anonymousReport = report('t-anon', 'PILOT_ORDER_FAILURE')
  const accountReport = report('t-auth', 'PILOT_ACCOUNT_FAILURE', [string('user.id', '7')])
  const logs: LogRecord[] = [{ traceId: 't-order', body: { stringValue: 'pilot-order' } }, anonymousReport, accountReport]

  const resource = { attributes: [string('service.version', 'sha-1')] }
  const packets = [
    { data: { resourceSpans: [{ resource, scopeSpans: [{ spans: [order, account, anonymous, failing] }] }] } },
    { data: { resourceLogs: [{ scopeLogs: [{ logRecords: logs }] }] } },
  ]
  const failed = () =>
    telemetryChecks({ packets, orderId: 'o-1', account: { orderId: 'o-2', userId: 7 }, version: 'sha-1' })
      .filter(({ pass }) => !pass)
      .map(({ check }) => check)

  assert.deepEqual(failed(), [])

  // A span event on the server span is reportable too: with the log, the failure opens two issues.
  anonymous.events.push({ name: 'exception', attributes: [string('exception.message', 'PILOT_ORDER_FAILURE')] })
  assert.deepEqual(failed(), ['The anonymous failure is reported once'])

  anonymous.events[0].attributes.push(string('monocle.exception.should_report', 'false'))
  assert.deepEqual(failed(), [])

  // An exception report without the user, or from another trace, does not attribute the failure.
  accountReport.attributes.pop()
  assert.deepEqual(failed(), ['The authenticated failure is reported once with the user ID'])

  accountReport.attributes.push(string('user.id', '7'))
  accountReport.traceId = 't-order'
  assert.deepEqual(failed(), ['The authenticated failure is reported once with the user ID'])
  accountReport.traceId = 't-auth'

  account.attributes.pop()
  resource.attributes = []
  assert.deepEqual(failed(), ['Server spans carry the release version', 'The authenticated request span carries the user ID'])

  const withoutAccount = telemetryChecks({ packets, orderId: 'o-1', version: 'sha-1' })
  assert.equal(withoutAccount.find(({ check }) => check.includes('authenticated request'))?.pass, false)
})

test(
  'receiver decodes gzip OTLP protobuf and accepts OTLP JSON without an agent',
  { skip: !existsSync(join(root, '.axis/proto')) },
  async () => {
    const receiver = await createReceiver({ protoPath: join(root, '.axis/proto'), port: 0 })
    const url = (path: string) => `http://127.0.0.1:${receiver.port}${path}`

    try {
      // Independently encoded OTLP wire bytes: field 1 resource_spans, resource field 1,
      // resource attributes field 1, key field 1 = "service.name", value field 2/string field 1 = "pilot".
      const resource = Buffer.from('0a1b0a190a170a0c736572766963652e6e616d6512070a0570696c6f74', 'hex')
      const response = await fetch(url('/v1/traces'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-protobuf', 'Content-Encoding': 'gzip' },
        body: gzipSync(resource),
      })
      assert.equal(response.status, 200)

      const attribute = receiver.packets[0].data.resourceSpans?.[0].resource?.attributes?.[0]
      assert.equal(attribute?.key, 'service.name')
      assert.equal(attribute?.value?.stringValue, 'pilot')

      const json = { resourceLogs: [{ scopeLogs: [{ logRecords: [{ body: { stringValue: 'pilot-log' } }] }] }] }
      const jsonResponse = await fetch(url('/v1/logs'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json),
      })
      assert.equal(jsonResponse.status, 200)
      assert.deepEqual(receiver.packets[1].data, json)
    } finally {
      await receiver.close()
    }
  },
)
