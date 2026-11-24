import { access, readFile, rm, writeFile } from 'node:fs/promises'

import { git } from './git.ts'

// Kept only while a rebase waits for the user to resolve a conflict, like git's own rebase state.
export interface RebaseState {
  /** The branch to check out again when the rebase ends. */
  branch: string
  forkRemote: string
  /** Each branch's head before the rebase, to push changed ones or undo. */
  originals: { ref: string; oid: string }[]
  /** Layers still to rebase, bottom to top. The first is the one being rebased. */
  pending: { ref: string; baseOid: string }[]
  /** Where the first pending layer goes. */
  onto: string
}

export async function readRebaseState(): Promise<RebaseState | null> {
  const text = await readFile(await statePath(), 'utf8').catch(() => null)
  return text ? (JSON.parse(text) as RebaseState) : null
}

export async function saveRebaseState(state: RebaseState): Promise<void> {
  await writeFile(await statePath(), JSON.stringify(state))
}

export async function clearRebaseState(): Promise<void> {
  await rm(await statePath(), { force: true })
}

// Git rebases keep their state in `rebase-merge` or `rebase-apply`, depending on the backend.
export async function isGitRebasing(): Promise<boolean> {
  for (const name of ['rebase-merge', 'rebase-apply']) {
    if (await exists(await gitPath(name))) {
      return true
    }
  }
  return false
}

function statePath() {
  return gitPath('forkstack-rebase.json')
}

// Resolves inside the right `.git` directory, also from worktrees.
async function gitPath(name: string) {
  return git('rev-parse', '--path-format=absolute', '--git-path', name)
}

async function exists(path: string) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}
