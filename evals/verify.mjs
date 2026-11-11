import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { telemetryChecks } from './receiver.mjs'

export function sourceFiles(directory, prefix = '') {
  const result = {}
  for (const entry of readdirSync(join(directory, prefix), { withFileTypes: true })) {
    if (['node_modules', '.git', '.agents', '.claude', 'build', 'dist', 'storage', 'tmp'].includes(entry.name)) continue
    if (entry.name === '.env' || entry.name.endsWith('.tsbuildinfo')) continue
    const path = join(prefix, entry.name)
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

export async function exerciseApp({ workspace, scenario, receiver, env }) {
  const cwd = scenario === 'adonis-monorepo' ? join(workspace, 'apps/backend') : workspace
  if (!existsSync(join(cwd, 'bin/server.ts'))) throw new Error('Fixture server entrypoint is missing')
  receiver.reset()
  const port = scenario === 'adonis-monorepo' ? 33371 : 33372
  const base = `http://127.0.0.1:${port}`
  const orderId = randomUUID()
  const child = spawn(process.execPath, ['--import=@poppinss/ts-exec', 'bin/server.ts'], {
    cwd, env: { ...env, HOST: '127.0.0.1', PORT: String(port), NODE_ENV: 'development', GITHUB_SHA: '1234567890abcdef1234567890abcdef12345678' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  child.stdout.on('data', (chunk) => { output = (output + chunk).slice(-100000) })
  child.stderr.on('data', (chunk) => { output = (output + chunk).slice(-100000) })
  const checks = []
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
    await delay(6500)
    checks.push({ check: 'Existing stdout logger preserved', pass: output.includes('pilot-order') })
    checks.push(...telemetryChecks({ packets: receiver.packets, orderId }))
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
