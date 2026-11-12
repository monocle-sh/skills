import { spawnSync, type SpawnSyncOptionsWithStringEncoding } from 'node:child_process'

export const agents = ['claude-code', 'codex'] as const

export type Agent = (typeof agents)[number]

type StatusCommand = (
  command: string,
  args: string[],
  options: SpawnSyncOptionsWithStringEncoding,
) => { status: number | null; stdout: string; stderr: string; error?: Error }

// Only these variables survive. API keys, provider routing, cloud credentials,
// Node hooks, and project secrets are never inherited.
const inheritedVariables = ['PATH', 'HOME', 'USER', 'SHELL', 'LANG', 'TERM', 'TMPDIR', 'SYSTEMROOT']

const loginStatusCommands = {
  'claude-code': { command: 'claude', args: ['auth', 'status'] },
  codex: { command: 'codex', args: ['login', 'status'] },
}

export function cleanEnvironment(source: NodeJS.ProcessEnv): Record<string, string> {
  const environment: Record<string, string> = {}

  for (const name of inheritedVariables) {
    const value = source[name]
    if (value) environment[name] = value
  }

  return environment
}

export function assertAgent(agent: string): asserts agent is Agent {
  if (!agents.includes(agent as Agent)) throw new Error('Only claude-code and codex are permitted.')
}

export function assertSubscription({
  agent,
  env,
  execute = spawnSync,
}: {
  agent: string
  env: Record<string, string>
  execute?: StatusCommand
}) {
  assertAgent(agent)

  const { command, args } = loginStatusCommands[agent]
  const result = execute(command, args, { env, encoding: 'utf8', timeout: 10_000 })

  if (result.error || result.status !== 0) {
    throw new Error('No usable local subscription login. Authenticate the CLI before running the pilot.')
  }

  if (agent === 'claude-code') {
    const status = JSON.parse(result.stdout)

    if (!status.loggedIn || status.authMethod !== 'claude.ai') {
      throw new Error('Claude must be logged in with a claude.ai subscription, not an API key or Console account.')
    }
  } else if (!`${result.stdout}${result.stderr}`.includes('Logged in using ChatGPT')) {
    throw new Error('Codex must be logged in with ChatGPT, not an API key.')
  }
}
