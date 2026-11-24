import { gh } from './gh.ts'
import { git } from './git.ts'
import type { Remotes } from './remotes.ts'

export interface Trunk {
  /** The upstream branch every PR in a stack merges into. */
  branch: string
  oid: string
}

// Commands that push or rebase need the latest trunk. Navigation only needs one to tell stack commits from trunk commits, so a local copy will do.
export async function findTrunk(remotes: Remotes, options: { fetch: boolean }): Promise<Trunk> {
  const branch = (await readDefaultBranch(remotes)) ?? (await fetchDefaultBranch(remotes))
  const oid = options.fetch ? await fetchTrunk(remotes, branch) : await readTrunk(remotes, branch)
  return { branch, oid }
}

// `git clone` and `git remote add -f` record the remote's default branch as `<remote>/HEAD`, which saves asking GitHub.
async function readDefaultBranch(remotes: Remotes) {
  const remote = remotes.upstreamRemote ?? remotes.forkRemote
  const ref = await git('symbolic-ref', '--quiet', '--short', `refs/remotes/${remote}/HEAD`).catch(
    () => null
  )
  return ref?.slice(remote.length + 1) ?? null
}

function fetchDefaultBranch(remotes: Remotes) {
  return gh(['api', `repos/${remotes.upstream}`, '--jq', '.default_branch'])
}

// Without an `upstream` remote, the branch is fetched by URL and only lands in `FETCH_HEAD`.
async function fetchTrunk(remotes: Remotes, branch: string) {
  const source = remotes.upstreamRemote ?? `https://github.com/${remotes.upstream}.git`
  await git('fetch', '--quiet', source, branch)
  return git('rev-parse', 'FETCH_HEAD')
}

// The fork's copy of the trunk is often behind, which only makes a stack's bottom branch look like it holds a few trunk commits.
async function readTrunk(remotes: Remotes, branch: string) {
  const refs = [`${remotes.upstreamRemote ?? remotes.forkRemote}/${branch}`, branch]
  for (const ref of refs) {
    const oid = await git('rev-parse', '--verify', '--quiet', `${ref}^{commit}`).catch(() => null)
    if (oid) {
      return oid
    }
  }
  throw new Error(`Can't find ${branch} of ${remotes.upstream} locally. Run \`git fetch\` first.`)
}

// `git checkout main` can't pick a remote by itself when both the fork and upstream have `main`.
export async function checkoutTrunk(remotes: Remotes, branch: string): Promise<void> {
  const exists = await git('rev-parse', '--verify', '--quiet', `refs/heads/${branch}`).catch(
    () => null
  )
  const remote = remotes.upstreamRemote ?? remotes.forkRemote
  await git(
    'checkout',
    '--quiet',
    ...(exists ? [branch] : ['-b', branch, '--track', `${remote}/${branch}`])
  )
}
