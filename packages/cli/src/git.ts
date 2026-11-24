import { exec } from './exec.ts'

export function git(...args: string[]): Promise<string> {
  return exec('git', args)
}

export async function currentBranch(): Promise<string> {
  const branch = await git('branch', '--show-current')
  if (!branch) {
    throw new Error('Check out a branch first. HEAD is detached.')
  }
  return branch
}

// Untracked files survive a rebase, so only changes to tracked ones block it.
export async function assertClean(): Promise<void> {
  if (await git('status', '--porcelain', '--untracked-files=no')) {
    throw new Error('Commit or stash your changes first.')
  }
}

// The fork's copy as of the last fetch or push, or `null` when the branch was never there.
export function readForkHead(forkRemote: string, branch: string): Promise<string | null> {
  return git('rev-parse', '--verify', '--quiet', `refs/remotes/${forkRemote}/${branch}`).catch(
    () => null
  )
}

export function isAncestor(ancestor: string, descendant: string): Promise<boolean> {
  return git('merge-base', '--is-ancestor', ancestor, descendant)
    .then(() => true)
    .catch(() => false)
}
