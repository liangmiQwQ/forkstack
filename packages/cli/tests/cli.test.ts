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
    spawnSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', ...args], {
      cwd: dir,
      encoding: 'utf8'
    }).stdout.trim()

  git('init', '--initial-branch', 'main')
  git('remote', 'add', 'origin', 'https://github.com/me/repo.git')
  git('remote', 'add', 'upstream', 'git@github.com:upstream/repo.git')
  return { dir, git }
}

// Commits each branch on top of the previous one, and records `main` as upstream's default branch, like a fetch does.
function createStack(git: (...args: string[]) => string, branches: string[]) {
  git('commit', '--allow-empty', '--message', 'trunk')
  git('update-ref', 'refs/remotes/upstream/main', 'HEAD')
  git('symbolic-ref', 'refs/remotes/upstream/HEAD', 'refs/remotes/upstream/main')

  for (const branch of branches) {
    git('checkout', '--quiet', '-b', branch)
    git('commit', '--allow-empty', '--message', branch)
  }
}

it('prints usage with --help', () => {
  const { status, stdout } = run(['--help'])
  expect(status).toBe(0)
  expect(stdout).toContain('view')
})

it('moves up the stack that git ancestry shows, without GitHub', () => {
  const { dir, git } = createClone()
  createStack(git, ['first', 'second', 'third'])
  git('checkout', '--quiet', 'first')

  const { status } = run(['up'], { cwd: dir, env: { GH_PATH: join(tmpdir(), 'missing-gh') } })
  expect(status).toBe(0)
  expect(git('branch', '--show-current')).toBe('second')
})

it('asks to install gh when the gh in GH_PATH does not exist', () => {
  const { dir, git } = createClone()
  git('checkout', '--quiet', '-b', 'feature')

  const { status, stderr } = run(['view'], {
    cwd: dir,
    env: { GH_PATH: join(tmpdir(), 'missing-gh') }
  })
  expect(status).toBe(1)
  expect(stderr).toContain('https://cli.github.com')
})
