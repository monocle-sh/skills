import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanEnvironment } from './subscription.mjs'

const root = dirname(fileURLToPath(import.meta.url))
export const starterRevision = '46d235932e3eb6472a16b740fa0b47b5f69fc6fc'
export const protoRevision = 'a8951735f7801e8adfaec5c0ace9262771cfec6e'

function write(path, content) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

function json(path, value) {
  write(path, `${JSON.stringify(value, null, 2)}\n`)
}

function command(cwd, file, args) {
  execFileSync(file, args, { cwd, env: cleanEnvironment(process.env), stdio: 'inherit' })
}

export function prepareFixtures() {
  const cache = join(root, '.axis')
  mkdirSync(cache, { recursive: true })
  const scratch = mkdtempSync(join(tmpdir(), 'monocle-fixtures-'))
  try {
    for (const [repo, revision, target] of [
      ['adonisjs/starter-kits', starterRevision, 'starters'],
      ['open-telemetry/opentelemetry-proto', protoRevision, 'proto'],
    ]) {
      const destination = join(scratch, target)
      command(scratch, 'git', ['clone', '--quiet', '--no-checkout', `https://github.com/${repo}.git`, destination])
      command(destination, 'git', ['checkout', '--quiet', revision])
    }
    const protoPath = join(cache, 'proto')
    rmSync(protoPath, { recursive: true, force: true })
    cpSync(join(scratch, 'proto', 'opentelemetry'), join(protoPath, 'opentelemetry'), { recursive: true })

    for (const [name, source] of [
      ['adonis-monorepo', 'api-monorepo'],
      ['adonis-inertia', 'inertia-react'],
    ]) {
      const destination = join(cache, 'fixtures', name)
      rmSync(destination, { recursive: true, force: true })
      cpSync(join(scratch, 'starters', source), destination, { recursive: true })
      const monorepo = name === 'adonis-monorepo'
      const backend = monorepo ? join(destination, 'apps/backend') : destination
      const pkgPath = join(destination, 'package.json')
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
      pkg.packageManager = 'pnpm@10.34.6'
      pkg.pnpm = { onlyBuiltDependencies: ['@swc/core', 'better-sqlite3', 'esbuild'] }
      json(pkgPath, pkg)
      write(join(destination, '.npmrc'), `store-dir=${join(cache, 'pnpm-store')}\n`)

      write(join(backend, '.env'), readFileSync(join(backend, '.env.example')))
      write(join(backend, 'start/pilot.ts'), `import router from '@adonisjs/core/services/router'
router.get('/pilot/orders/:id', async ({ params, logger }) => {
  logger.info({ orderId: params.id }, 'pilot-order')
  return { id: params.id, amount: 42 }
})
router.get('/pilot/failure', () => { throw new Error('PILOT_ORDER_FAILURE') })
`)
      const routesPath = join(backend, 'start/routes.ts')
      write(routesPath, `import './pilot.js'\n${readFileSync(routesPath, 'utf8')}`)
      if (monorepo) {
        const frontend = join(destination, 'apps/frontend')
        json(join(frontend, 'package.json'), {
          name: 'pilot-frontend', private: true, type: 'module',
          scripts: { dev: 'vite', build: 'vite build', typecheck: 'tsc --noEmit' },
          dependencies: { react: '19.3.0', 'react-dom': '19.3.0' },
          devDependencies: { vite: '8.3.0', typescript: '6.0.3', '@types/react': '19.3.0', '@types/react-dom': '19.3.0' },
        })
        write(join(frontend, 'index.html'), '<div id="root"></div><script type="module" src="/src/main.tsx"></script>\n')
        write(join(frontend, 'src/main.tsx'), `import { createRoot } from 'react-dom/client'
createRoot(document.getElementById('root')!).render(<h1>Orders</h1>)
`)
        json(join(frontend, 'tsconfig.json'), {
          compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'bundler', jsx: 'react-jsx', strict: true, noEmit: true, skipLibCheck: true },
          include: ['src'],
        })
      }
      write(join(destination, 'DEPLOYMENT.md'), `# Existing delivery contract

${monorepo ? 'Deploy apps/backend and apps/frontend separately.' : 'Deploy the Adonis server and public/assets together as one application.'}
The platform provides GITHUB_SHA for release detection. There is no deployment API token.
Production server output is build/. Browser output is ${monorepo ? 'apps/frontend/dist/' : 'public/assets/'}.
Keep private source-map credentials out of browser environment variables.
`)
      write(join(destination, '.gitignore'), `${readFileSync(join(destination, '.gitignore'), 'utf8')}\n**/.env\n**/node_modules/\n**/*.tsbuildinfo\n`)
      const lockPath = join(root, 'locks', `${name}.yaml`)
      if (existsSync(lockPath)) {
        cpSync(lockPath, join(destination, 'pnpm-lock.yaml'))
        command(destination, 'pnpm', ['install', '--frozen-lockfile', '--ignore-scripts'])
      } else {
        command(destination, 'pnpm', ['install', '--ignore-scripts'])
        mkdirSync(dirname(lockPath), { recursive: true })
        cpSync(join(destination, 'pnpm-lock.yaml'), lockPath)
      }
      // Keep only the template. AXIS installs its dependencies from the local store.
      rmSync(join(destination, 'node_modules'), { recursive: true, force: true })
      for (const app of ['apps/backend', 'apps/frontend']) {
        rmSync(join(destination, app, 'node_modules'), { recursive: true, force: true })
      }
    }
    console.log('Prepared 2 pinned fixtures and OTLP schemas. No agents started.')
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) prepareFixtures()
