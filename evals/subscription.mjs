import { spawnSync } from 'node:child_process'

// Do not inherit API keys, provider routing, cloud credentials, or project secrets.
export function cleanEnvironment(source) {
  return Object.fromEntries(
    ['PATH', 'HOME', 'USER', 'SHELL', 'LANG', 'TERM', 'TMPDIR', 'SYSTEMROOT']
      .filter((name) => source[name])
      .map((name) => [name, source[name]])
  )
}

export function assertSubscription({ agent, env, execute = spawnSync }) {
  if (!['claude-code', 'codex'].includes(agent)) throw new Error('Only claude-code and codex are permitted.')
  const args = agent === 'claude-code' ? ['auth', 'status'] : ['login', 'status']
  const result = execute(agent === 'claude-code' ? 'claude' : 'codex', args, {
    env, encoding: 'utf8', timeout: 10000,
  })
  if (result.error || result.status !== 0) throw new Error('No usable local subscription login. Authenticate the CLI before running the pilot.')
  if (agent === 'claude-code') {
    const status = JSON.parse(result.stdout)
    if (!status.loggedIn || status.authMethod !== 'claude.ai') {
      throw new Error('Claude must be logged in with a claude.ai subscription, not an API key or Console account.')
    }
  } else if (!`${result.stdout}${result.stderr}`.includes('Logged in using ChatGPT')) {
    throw new Error('Codex must be logged in with ChatGPT, not an API key.')
  }
}
