import { spawn, spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { cases } from './fixtures.mjs'
import { telemetryChecks } from './receiver.mjs'

export function sourceFiles(directory, prefix = '') {
  const result = {}
  for (const entry of readdirSync(join(directory, prefix), { withFileTypes: true })) {
    if (['node_modules', '.git', '.agents', '.claude', '.adonisjs', '.turbo', 'build', 'dist', 'storage', 'tmp'].includes(entry.name)) continue
    if (entry.name === '.env' || entry.name.endsWith('.tsbuildinfo')) continue
    const path = join(prefix, entry.name)
    // Ignored Vite output of the Inertia starters, written by local builds.
    if (path === join('public', 'assets')) continue
    if (entry.isDirectory()) Object.assign(result, sourceFiles(directory, path))
    else if (entry.isFile()) result[path] = readFileSync(join(directory, path), 'utf8')
  }
  return result
}

export function compareChanges({ before, after }) {
  const changes = []
  const dependencies = []
  for (const path of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (before[path] === after[path]) continue
    changes.push({ path, before: before[path] ?? null, after: after[path] ?? null })
    if (!path.endsWith('package.json')) continue
    const oldDeps = JSON.parse(before[path] ?? '{}')
    const newDeps = JSON.parse(after[path] ?? '{}')
    for (const group of ['dependencies', 'devDependencies']) {
      for (const [name, version] of Object.entries(newDeps[group] ?? {})) {
        if (!oldDeps[group]?.[name]) dependencies.push({ path, group, name, version })
      }
    }
  }
  const productionChanges = changes.filter(({ path }) => !/lock\.|lock\.yaml|\.md$|\.json$/.test(path))
  const lines = (text) => text ? text.trimEnd().split('\n').length : 0
  const productionLinesDelta = productionChanges.reduce((total, change) => total + lines(change.after) - lines(change.before), 0)
  return { changes, dependencies, productionFilesChanged: productionChanges.length, productionLinesDelta }
}

export function completionChecks(text) {
  let completion
  try {
    completion = JSON.parse(text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, ''))
  } catch {
    return [{ check: 'Structured completion report', pass: false }]
  }
  const capabilities = completion?.capabilities ?? {}
  return ['server', 'browser', 'source_maps', 'deployments', 'analytics', 'replay'].map((name) => {
    const item = capabilities[name]
    const valid = ['configured', 'unverified', 'blocked', 'disabled'].includes(item?.status) && typeof item.evidence === 'string' && item.evidence.trim().length > 0
    return {
      check: `Explicit disposition for ${name}`,
      pass: valid && (!['analytics', 'replay'].includes(name) || item.status === 'disabled'),
      observed: item?.status ?? 'missing',
    }
  })
}

const release = '1234567890abcdef1234567890abcdef12345678'

/**
 * Cookie jar for the session starters: keeps the latest value of each cookie.
 */
function cookieJar() {
  const cookies = new Map()
  return {
    store(response) {
      for (const header of response.headers.getSetCookie()) {
        const [pair] = header.split(';')
        const index = pair.indexOf('=')
        cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1))
      }
    },
    get: (name) => cookies.get(name),
    header: () => [...cookies].map(([name, value]) => `${name}=${value}`).join('; '),
  }
}

/**
 * Create an account through the starter's own signup flow and return the request headers
 * that authenticate as it: a bearer token for API starters, the session cookie for Inertia.
 */
async function signUp({ base, auth }) {
  const email = `ada-${randomUUID().slice(0, 8)}@example.com`
  const body = JSON.stringify({ fullName: 'Ada Lovelace', email, password: 'pilot-password', passwordConfirmation: 'pilot-password' })
  if (auth === 'token') {
    const response = await fetch(`${base}/api/v1/auth/signup`, {
      method: 'POST', body, headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, signal: AbortSignal.timeout(5000),
    })
    const json = await response.json()
    const token = json.token ?? json.data?.token
    if (!response.ok || typeof token !== 'string') throw new Error(`Signup failed with HTTP ${response.status}`)
    return { Authorization: `Bearer ${token}`, Accept: 'application/json' }
  }
  // Shield sets the session and XSRF-TOKEN cookies on any GET request.
  const jar = cookieJar()
  jar.store(await fetch(`${base}/pilot/orders/csrf`, { signal: AbortSignal.timeout(5000) }))
  const xsrf = jar.get('XSRF-TOKEN')
  if (!xsrf) throw new Error('The session starter did not set an XSRF-TOKEN cookie')
  const response = await fetch(`${base}/signup`, {
    method: 'POST', body, redirect: 'manual', signal: AbortSignal.timeout(5000),
    headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': decodeURIComponent(xsrf), Cookie: jar.header() },
  })
  if (response.status !== 302 || !response.headers.get('location')?.includes('dashboard')) throw new Error(`Signup failed with HTTP ${response.status}`)
  jar.store(response)
  return { Cookie: jar.header(), Accept: 'application/json' }
}

export async function exerciseApp({ workspace, scenario, receiver, env }) {
  const { backend, auth, port } = cases[scenario]
  const cwd = join(workspace, backend)
  if (!existsSync(join(cwd, 'bin/server.ts'))) throw new Error('Fixture server entrypoint is missing')
  const appEnv = { ...env, HOST: '127.0.0.1', PORT: String(port), NODE_ENV: 'development', GITHUB_SHA: release }
  const checks = []
  const migration = spawnSync(process.execPath, ['ace.js', 'migration:run', '--force'], { cwd, env: appEnv, encoding: 'utf8', timeout: 120000 })
  checks.push({ check: 'Database migrations still run', pass: migration.status === 0 })
  receiver.reset()
  const base = `http://127.0.0.1:${port}`
  const orderId = randomUUID()
  const child = spawn(process.execPath, ['--import=@poppinss/ts-exec', 'bin/server.ts'], {
    cwd, env: appEnv, stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = `${migration.stdout ?? ''}${migration.stderr ?? ''}`
  child.stdout.on('data', (chunk) => { output = (output + chunk).slice(-100000) })
  child.stderr.on('data', (chunk) => { output = (output + chunk).slice(-100000) })
  try {
    let ready = false
    for (let attempt = 0; attempt < 80; attempt++) {
      if (child.exitCode !== null) throw new Error('Development server exited before readiness')
      try {
        const response = await fetch(`${base}/pilot/orders/ready`, { signal: AbortSignal.timeout(1000) })
        if (response.ok) { ready = true; break }
      } catch {}
      await delay(250)
    }
    if (!ready) throw new Error(`Development server readiness timed out:\n${output}`)
    const response = await fetch(`${base}/pilot/orders/${orderId}`, { signal: AbortSignal.timeout(5000) })
    const body = await response.json()
    checks.push({ check: 'Order response preserved', pass: response.status === 200 && body.id === orderId && body.amount === 42 })
    const failure = await fetch(`${base}/pilot/failure`, { signal: AbortSignal.timeout(5000) })
    checks.push({ check: 'Failure response preserved', pass: failure.status === 500 })

    let account
    try {
      const headers = await signUp({ base, auth })
      const accountOrderId = randomUUID()
      const accountOrder = await fetch(`${base}/pilot/account/orders/${accountOrderId}`, { headers, signal: AbortSignal.timeout(5000) })
      const accountBody = accountOrder.ok ? await accountOrder.json() : {}
      if (accountBody.owner !== undefined) account = { orderId: accountOrderId, userId: accountBody.owner }
      checks.push({ check: 'Authenticated response preserved', pass: accountOrder.status === 200 && accountBody.id === accountOrderId && account !== undefined })
      const accountFailure = await fetch(`${base}/pilot/account/failure`, { headers, signal: AbortSignal.timeout(5000) })
      checks.push({ check: 'Authenticated failure response preserved', pass: accountFailure.status === 500 })
    } catch (error) {
      checks.push({ check: 'Starter signup still works', pass: false, error: error.message })
    }

    await delay(6500)
    checks.push({ check: 'Existing stdout logger preserved', pass: output.includes('pilot-order') })
    checks.push(...telemetryChecks({ packets: receiver.packets, orderId, account, version: release }))
    return { checks, output, packets: [...receiver.packets] }
  } finally {
    const closed = new Promise((resolve) => child.once('close', resolve))
    child.kill('SIGTERM')
    const timer = setTimeout(() => child.kill('SIGKILL'), 3000)
    timer.unref()
    if (child.exitCode === null) await closed
    clearTimeout(timer)
  }
}
