import { spawn, spawnSync, type ChildProcessByStdio } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Readable } from 'node:stream'
import { setTimeout as delay } from 'node:timers/promises'
import { cases, type FixtureCase } from './fixtures.ts'
import { telemetryChecks, type Account, type Packet, type Receiver } from './receiver.ts'

export interface Check {
  check: string
  pass: boolean
  observed?: unknown
  error?: string
}

type SourceFiles = Record<string, string>

const ignoredEntries = ['node_modules', '.git', '.agents', '.claude', '.adonisjs', '.turbo', 'build', 'dist', 'storage', 'tmp']
const capabilities = ['server', 'browser', 'source_maps', 'deployments', 'analytics', 'replay']
const dispositions = ['configured', 'unverified', 'blocked', 'disabled']
const mustStayDisabled = ['analytics', 'replay']

const release = '1234567890abcdef1234567890abcdef12345678'
const requestTimeoutMs = 5000
const maxLogLength = 100_000

// Wait for batched telemetry exports before reading the receiver.
const exportDelayMs = 6500

export function sourceFiles(directory: string, prefix = ''): SourceFiles {
  const files: SourceFiles = {}

  for (const entry of readdirSync(join(directory, prefix), { withFileTypes: true })) {
    if (ignoredEntries.includes(entry.name)) continue
    if (entry.name === '.env' || entry.name.endsWith('.tsbuildinfo')) continue

    const path = join(prefix, entry.name)

    // Ignored Vite output of the Inertia starters, written by local builds.
    if (path === join('public', 'assets')) continue

    if (entry.isDirectory()) Object.assign(files, sourceFiles(directory, path))
    else if (entry.isFile()) files[path] = readFileSync(join(directory, path), 'utf8')
  }

  return files
}

function lineCount(text: string | null) {
  return text ? text.trimEnd().split('\n').length : 0
}

function addedDependencies(path: string, before = '{}', after = '{}') {
  const oldPackage = JSON.parse(before)
  const newPackage = JSON.parse(after)
  const added = []

  for (const group of ['dependencies', 'devDependencies']) {
    for (const [name, version] of Object.entries(newPackage[group] ?? {})) {
      if (!oldPackage[group]?.[name]) added.push({ path, group, name, version })
    }
  }

  return added
}

export function compareChanges({ before, after }: { before: SourceFiles; after: SourceFiles }) {
  const changes = []
  const dependencies = []

  for (const path of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (before[path] === after[path]) continue

    changes.push({ path, before: before[path] ?? null, after: after[path] ?? null })
    if (path.endsWith('package.json')) dependencies.push(...addedDependencies(path, before[path], after[path]))
  }

  // Lockfiles, Markdown, and JSON configuration are not production code.
  const productionChanges = changes.filter(({ path }) => !/lock\.|lock\.yaml|\.md$|\.json$/.test(path))
  const productionLinesDelta = productionChanges.reduce(
    (total, change) => total + lineCount(change.after) - lineCount(change.before),
    0,
  )

  return { changes, dependencies, productionFilesChanged: productionChanges.length, productionLinesDelta }
}

export function completionChecks(text: string): Check[] {
  let completion

  try {
    completion = JSON.parse(text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, ''))
  } catch {
    return [{ check: 'Structured completion report', pass: false }]
  }

  const reported = completion?.capabilities ?? {}

  return capabilities.map((name) => {
    const item = reported[name]
    const valid =
      dispositions.includes(item?.status) && typeof item.evidence === 'string' && item.evidence.trim().length > 0

    return {
      check: `Explicit disposition for ${name}`,
      pass: valid && (!mustStayDisabled.includes(name) || item.status === 'disabled'),
      observed: item?.status ?? 'missing',
    }
  })
}

function get(url: string, headers?: Record<string, string>) {
  return fetch(url, { headers, signal: AbortSignal.timeout(requestTimeoutMs) })
}

/**
 * Cookie jar for the session starters: keeps the latest value of each cookie.
 */
function cookieJar() {
  const cookies = new Map<string, string>()

  return {
    store(response: Response) {
      for (const header of response.headers.getSetCookie()) {
        const [pair] = header.split(';')
        const index = pair.indexOf('=')
        cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1))
      }
    },
    get: (name: string) => cookies.get(name),
    header: () => [...cookies].map(([name, value]) => `${name}=${value}`).join('; '),
  }
}

/**
 * Create an account through the starter's own signup flow and return the request headers
 * that authenticate as it: a bearer token for API starters, the session cookie for Inertia.
 */
async function signUp(base: string, auth: FixtureCase['auth']): Promise<Record<string, string>> {
  const email = `ada-${randomUUID().slice(0, 8)}@example.com`
  const body = JSON.stringify({
    fullName: 'Ada Lovelace',
    email,
    password: 'pilot-password',
    passwordConfirmation: 'pilot-password',
  })

  if (auth === 'token') {
    const response = await fetch(`${base}/api/v1/auth/signup`, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      signal: AbortSignal.timeout(requestTimeoutMs),
    })
    const json = await response.json()
    const token = json.token ?? json.data?.token

    if (!response.ok || typeof token !== 'string') throw new Error(`Signup failed with HTTP ${response.status}`)

    return { Authorization: `Bearer ${token}`, Accept: 'application/json' }
  }

  // Shield sets the session and XSRF-TOKEN cookies on any GET request.
  const jar = cookieJar()
  jar.store(await get(`${base}/pilot/orders/csrf`))

  const xsrf = jar.get('XSRF-TOKEN')
  if (!xsrf) throw new Error('The session starter did not set an XSRF-TOKEN cookie')

  const response = await fetch(`${base}/signup`, {
    method: 'POST',
    body,
    redirect: 'manual',
    signal: AbortSignal.timeout(requestTimeoutMs),
    headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': decodeURIComponent(xsrf), Cookie: jar.header() },
  })

  if (response.status !== 302 || !response.headers.get('location')?.includes('dashboard')) {
    throw new Error(`Signup failed with HTTP ${response.status}`)
  }

  jar.store(response)

  return { Cookie: jar.header(), Accept: 'application/json' }
}

type Server = ChildProcessByStdio<null, Readable, Readable>

function startServer(cwd: string, env: Record<string, string>, initialOutput: string) {
  const child: Server = spawn(process.execPath, ['--import=@poppinss/ts-exec', 'bin/server.ts'], {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let output = initialOutput
  const append = (chunk: Buffer) => {
    output = (output + chunk).slice(-maxLogLength)
  }

  child.stdout.on('data', append)
  child.stderr.on('data', append)

  return { child, output: () => output }
}

async function waitForReadiness(base: string, server: ReturnType<typeof startServer>) {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (server.child.exitCode !== null) throw new Error('Development server exited before readiness')

    try {
      const response = await fetch(`${base}/pilot/orders/ready`, { signal: AbortSignal.timeout(1000) })
      if (response.ok) return
    } catch {}

    await delay(250)
  }

  throw new Error(`Development server readiness timed out:\n${server.output()}`)
}

async function stopServer(child: Server) {
  const closed = new Promise((resolve) => child.once('close', resolve))
  child.kill('SIGTERM')

  const timer = setTimeout(() => child.kill('SIGKILL'), 3000)
  timer.unref()

  if (child.exitCode === null) await closed
  clearTimeout(timer)
}

export async function exerciseApp({
  workspace,
  scenario,
  receiver,
  env,
}: {
  workspace: string
  scenario: string
  receiver: Receiver
  env: Record<string, string>
}): Promise<{ checks: Check[]; output: string; packets: Packet[] }> {
  const { backend, auth, port } = cases[scenario]
  const cwd = join(workspace, backend)
  if (!existsSync(join(cwd, 'bin/server.ts'))) throw new Error('Fixture server entrypoint is missing')

  const appEnv = { ...env, HOST: '127.0.0.1', PORT: String(port), NODE_ENV: 'development', GITHUB_SHA: release }
  const checks: Check[] = []

  const migration = spawnSync(process.execPath, ['ace.js', 'migration:run', '--force'], {
    cwd,
    env: appEnv,
    encoding: 'utf8',
    timeout: 120_000,
  })
  checks.push({ check: 'Database migrations still run', pass: migration.status === 0 })

  receiver.reset()
  const base = `http://127.0.0.1:${port}`
  const orderId = randomUUID()
  const server = startServer(cwd, appEnv, `${migration.stdout ?? ''}${migration.stderr ?? ''}`)

  try {
    await waitForReadiness(base, server)

    const order = await get(`${base}/pilot/orders/${orderId}`)
    const orderBody = await order.json()
    checks.push({
      check: 'Order response preserved',
      pass: order.status === 200 && orderBody.id === orderId && orderBody.amount === 42,
    })

    const failure = await get(`${base}/pilot/failure`)
    checks.push({ check: 'Failure response preserved', pass: failure.status === 500 })

    let account: Account | undefined

    try {
      const headers = await signUp(base, auth)

      const accountOrderId = randomUUID()
      const accountOrder = await get(`${base}/pilot/account/orders/${accountOrderId}`, headers)
      const accountBody = accountOrder.ok ? await accountOrder.json() : {}
      if (accountBody.owner !== undefined) account = { orderId: accountOrderId, userId: accountBody.owner }

      checks.push({
        check: 'Authenticated response preserved',
        pass: accountOrder.status === 200 && accountBody.id === accountOrderId && account !== undefined,
      })

      const accountFailure = await get(`${base}/pilot/account/failure`, headers)
      checks.push({ check: 'Authenticated failure response preserved', pass: accountFailure.status === 500 })
    } catch (error) {
      checks.push({ check: 'Starter signup still works', pass: false, error: (error as Error).message })
    }

    await delay(exportDelayMs)

    checks.push({ check: 'Existing stdout logger preserved', pass: server.output().includes('pilot-order') })
    checks.push(...telemetryChecks({ packets: receiver.packets, orderId, account, version: release }))

    return { checks, output: server.output(), packets: [...receiver.packets] }
  } finally {
    await stopServer(server.child)
  }
}
