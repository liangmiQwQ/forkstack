import { spawnSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { expect, it } from 'vite-plus/test'

import { chooseStack } from '../src/local-stack.ts'
import type { LocalBranch } from '../src/local-stack.ts'

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

function localBranch(name: string, commits: string[], pastHeads: string[] = []): LocalBranch {
  return { name, headOid: commits.at(-1) ?? name, commits, pastHeads }
}

// Records `main` as upstream's default branch, like a fetch does.
function commitTrunk(git: (...args: string[]) => string) {
  git('commit', '--allow-empty', '--message', 'trunk')
  git('update-ref', 'refs/remotes/upstream/main', 'HEAD')
  git('symbolic-ref', 'refs/remotes/upstream/HEAD', 'refs/remotes/upstream/main')
}

// Commits each branch on top of the previous one, and records `main` as upstream's default branch, like a fetch does.
function createStack(git: (...args: string[]) => string, branches: string[]) {
  commitTrunk(git)

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

it('moves up after a new commit on a lower branch, though the branch above was created at its old head', () => {
  const { dir, git } = createClone()
  createStack(git, ['first', 'second', 'third'])
  git('checkout', '--quiet', 'second')
  git('commit', '--allow-empty', '--message', 'second, again')

  const { status, stderr } = run(['up'], {
    cwd: dir,
    env: { GH_PATH: join(tmpdir(), 'missing-gh') }
  })
  expect(stderr).toBe('')
  expect(status).toBe(0)
  expect(git('branch', '--show-current')).toBe('third')
})

it('moves up past a leftover branch that still contains an older head', () => {
  const { dir, git } = createClone()
  commitTrunk(git)
  git('checkout', '--quiet', '-b', 'layer-1')
  git('commit', '--allow-empty', '--message', 'layer-1')
  git('checkout', '--quiet', '-b', 'old-combined')
  git('commit', '--allow-empty', '--message', 'old-combined')
  git('checkout', '--quiet', 'layer-1')
  git('commit', '--allow-empty', '--message', 'layer-1, again')
  git('checkout', '--quiet', '-b', 'layer-2')
  git('commit', '--allow-empty', '--message', 'layer-2')
  git('checkout', '--quiet', 'layer-1')

  const { status, stderr } = run(['up'], {
    cwd: dir,
    env: { GH_PATH: join(tmpdir(), 'missing-gh') }
  })
  expect(stderr).toBe('')
  expect(status).toBe(0)
  expect(git('branch', '--show-current')).toBe('layer-2')
})

it('names a past-head branch that splits the stack, and can leave branches out', () => {
  const branches = [
    localBranch('layer-1', ['oid-1', 'oid-1b'], ['oid-1']),
    localBranch('old-combined', ['oid-1', 'oid-old']),
    localBranch('layer-2a', ['oid-1', 'oid-1b', 'oid-2a']),
    localBranch('layer-2b', ['oid-1', 'oid-1b', 'oid-2b'])
  ]

  expect(() => chooseStack(branches, 'layer-2a')).toThrow(/`old-combined`/)
  expect(() => chooseStack(branches, 'layer-2a')).toThrow(/--exclude/)

  const kept = chooseStack(branches, 'layer-2a', ['old-combined', 'layer-2b'])
  expect(kept.map(branch => branch.name)).toEqual(['layer-1', 'layer-2a'])
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
