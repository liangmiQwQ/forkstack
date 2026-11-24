import { spawnSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { expect, it } from 'vite-plus/test'

const bin = fileURLToPath(new URL('../bin/forkstack.mjs', import.meta.url))

// Runs the built binary, so `build` must run before `test`, like CI does.
function run(args: string[], options: { cwd?: string; env?: Record<string, string> } = {}) {
  // oxlint-disable-next-line node/no-sync -- blocking is fine in a test
  return spawnSync(process.execPath, [bin, ...args], {
    encoding: 'utf8',
    cwd: options.cwd,
    env: { ...process.env, ...options.env }
  })
}

// A clone of a fork, with the remotes `gh repo fork` sets up.
function createClone() {
  // oxlint-disable-next-line node/no-sync -- blocking is fine in a test
  const dir = mkdtempSync(join(tmpdir(), 'forkstack-'))
  const git = (...args: string[]) =>
    // oxlint-disable-next-line node/no-sync -- blocking is fine in a test
    spawnSync('git', args, { cwd: dir, encoding: 'utf8' })

  git('init', '--initial-branch', 'feature')
  git('remote', 'add', 'origin', 'https://github.com/me/repo.git')
  git('remote', 'add', 'upstream', 'git@github.com:upstream/repo.git')
  return dir
}

it('prints usage with --help', () => {
  const { status, stdout } = run(['--help'])
  expect(status).toBe(0)
  expect(stdout).toContain('view')
})

it('asks to install gh when the gh in GH_PATH does not exist', () => {
  const { status, stderr } = run(['view'], {
    cwd: createClone(),
    env: { GH_PATH: join(tmpdir(), 'missing-gh') }
  })
  expect(status).toBe(1)
  expect(stderr).toContain('https://cli.github.com')
})
