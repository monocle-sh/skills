import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { cleanEnvironment } from './subscription.ts'

export const starterRevision = '46d235932e3eb6472a16b740fa0b47b5f69fc6fc'
export const protoRevision = 'a8951735f7801e8adfaec5c0ace9262771cfec6e'

export interface FixtureCase {
  /** Starter directory in adonisjs/starter-kits. */
  source: string
  /** Adonis application inside the fixture. */
  backend: string
  /** Access tokens for API starters, cookie sessions for Inertia starters. */
  auth: 'token' | 'session'
  /** Port of the development server during runtime checks. */
  port: number
  /** Delivery contract written to DEPLOYMENT.md. */
  delivery: string
}

const inertiaDelivery =
  'Deploy the Adonis server and public/assets together as one application. Browser output is public/assets/.'

export const cases: Record<string, FixtureCase> = {
  'adonis-monorepo': {
    source: 'api-monorepo',
    backend: 'apps/backend',
    auth: 'token',
    port: 33371,
    delivery: 'Deploy apps/backend and apps/frontend separately. Browser output is apps/frontend/dist/.',
  },
  'adonis-inertia': {
    source: 'inertia-react',
    backend: '.',
    auth: 'session',
    port: 33372,
    delivery: inertiaDelivery,
  },
  'adonis-api': {
    source: 'api',
    backend: '.',
    auth: 'token',
    port: 33373,
    delivery: 'Deploy the Adonis API server alone. It has no browser frontend.',
  },
  'adonis-inertia-vue': {
    source: 'inertia-vue',
    backend: '.',
    auth: 'session',
    port: 33374,
    delivery: inertiaDelivery,
  },
}

const root = import.meta.dirname
const cache = join(root, '.axis')

const pilotRoutes = `import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

router.get('/pilot/orders/:id', async ({ params, logger }) => {
  logger.info({ orderId: params.id }, 'pilot-order')
  return { id: params.id, amount: 42 }
})
router.get('/pilot/failure', () => { throw new Error('PILOT_ORDER_FAILURE') })

router
  .group(() => {
    router.get('/pilot/account/orders/:id', async ({ params, logger, auth }) => {
      logger.info({ orderId: params.id }, 'pilot-account-order')
      return { id: params.id, owner: auth.user!.id }
    })
    router.get('/pilot/account/failure', () => { throw new Error('PILOT_ACCOUNT_FAILURE') })
  })
  .use(middleware.auth())
`

function write(path: string, content: string | Uint8Array) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

function writeJson(path: string, value: unknown) {
  write(path, `${JSON.stringify(value, null, 2)}\n`)
}

function run(cwd: string, file: string, args: string[]) {
  execFileSync(file, args, { cwd, env: cleanEnvironment(process.env), stdio: 'inherit' })
}

function clone(scratch: string, repository: string, revision: string, target: string) {
  const destination = join(scratch, target)

  run(scratch, 'git', ['clone', '--quiet', '--no-checkout', `https://github.com/${repository}.git`, destination])
  run(destination, 'git', ['checkout', '--quiet', revision])
}

function pinPackageManager(destination: string) {
  const path = join(destination, 'package.json')
  const pkg = JSON.parse(readFileSync(path, 'utf8'))

  pkg.packageManager = 'pnpm@10.34.6'
  pkg.pnpm = { onlyBuiltDependencies: ['@swc/core', 'better-sqlite3', 'esbuild'] }

  writeJson(path, pkg)
  write(join(destination, '.npmrc'), `store-dir=${join(cache, 'pnpm-store')}\n`)
}

function addPilotRoutes(backend: string) {
  const routesPath = join(backend, 'start/routes.ts')

  write(join(backend, '.env'), readFileSync(join(backend, '.env.example')))
  write(join(backend, 'start/pilot.ts'), pilotRoutes)
  write(routesPath, `import './pilot.js'\n${readFileSync(routesPath, 'utf8')}`)
}

// The upstream API monorepo has an empty frontend. Fill it with a small React and Vite app.
function addMonorepoFrontend(destination: string) {
  const frontend = join(destination, 'apps/frontend')

  writeJson(join(frontend, 'package.json'), {
    name: 'pilot-frontend',
    private: true,
    type: 'module',
    scripts: { dev: 'vite', build: 'vite build', typecheck: 'tsc --noEmit' },
    dependencies: { react: '19.3.0', 'react-dom': '19.3.0' },
    devDependencies: { vite: '8.3.0', typescript: '6.0.3', '@types/react': '19.3.0', '@types/react-dom': '19.3.0' },
  })

  write(join(frontend, 'index.html'), '<div id="root"></div><script type="module" src="/src/main.tsx"></script>\n')

  write(
    join(frontend, 'src/main.tsx'),
    `import { createRoot } from 'react-dom/client'
createRoot(document.getElementById('root')!).render(<h1>Orders</h1>)
`,
  )

  writeJson(join(frontend, 'tsconfig.json'), {
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'bundler',
      jsx: 'react-jsx',
      strict: true,
      noEmit: true,
      skipLibCheck: true,
    },
    include: ['src'],
  })
}

function addDeliveryContract(destination: string, delivery: string) {
  write(
    join(destination, 'DEPLOYMENT.md'),
    `# Existing delivery contract

${delivery}
The platform provides GITHUB_SHA for release detection. There is no deployment API token.
Production server output is build/.
Keep private source-map credentials out of browser environment variables.
`,
  )

  const gitignorePath = join(destination, '.gitignore')
  write(gitignorePath, `${readFileSync(gitignorePath, 'utf8')}\n**/.env\n**/node_modules/\n**/*.tsbuildinfo\n`)
}

// Install from the checked-in lockfile. Without one, resolve once and record it.
function installDependencies(name: string, destination: string) {
  const lockPath = join(root, 'locks', `${name}.yaml`)

  if (existsSync(lockPath)) {
    cpSync(lockPath, join(destination, 'pnpm-lock.yaml'))
    run(destination, 'pnpm', ['install', '--frozen-lockfile', '--ignore-scripts'])
  } else {
    run(destination, 'pnpm', ['install', '--ignore-scripts'])
    mkdirSync(dirname(lockPath), { recursive: true })
    cpSync(join(destination, 'pnpm-lock.yaml'), lockPath)
  }

  // Keep only the template. AXIS installs its dependencies from the local store.
  for (const directory of ['.', 'apps/backend', 'apps/frontend']) {
    rmSync(join(destination, directory, 'node_modules'), { recursive: true, force: true })
  }
}

function prepareFixture(name: string, fixture: FixtureCase, starters: string) {
  const destination = join(cache, 'fixtures', name)

  rmSync(destination, { recursive: true, force: true })
  cpSync(join(starters, fixture.source), destination, { recursive: true })

  pinPackageManager(destination)
  addPilotRoutes(join(destination, fixture.backend))
  if (name === 'adonis-monorepo') addMonorepoFrontend(destination)
  addDeliveryContract(destination, fixture.delivery)
  installDependencies(name, destination)
}

export function prepareFixtures() {
  mkdirSync(cache, { recursive: true })
  const scratch = mkdtempSync(join(tmpdir(), 'monocle-fixtures-'))

  try {
    clone(scratch, 'adonisjs/starter-kits', starterRevision, 'starters')
    clone(scratch, 'open-telemetry/opentelemetry-proto', protoRevision, 'proto')

    const protoPath = join(cache, 'proto')
    rmSync(protoPath, { recursive: true, force: true })
    cpSync(join(scratch, 'proto', 'opentelemetry'), join(protoPath, 'opentelemetry'), { recursive: true })

    for (const [name, fixture] of Object.entries(cases)) {
      prepareFixture(name, fixture, join(scratch, 'starters'))
    }

    console.log(`Prepared ${Object.keys(cases).length} pinned fixtures and OTLP schemas. No agents started.`)
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
}

if (process.argv[1] === import.meta.filename) prepareFixtures()
