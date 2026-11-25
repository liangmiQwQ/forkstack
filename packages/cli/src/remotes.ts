import type { Args } from 'gunshi'

import { gh } from './gh.ts'
import { git } from './git.ts'

export interface Remotes {
  /** `owner/name` of the fork every stack branch is pushed to. */
  fork: string
  /** Git remote of the fork. */
  forkRemote: string
  /** `owner/name` of the repository the PRs merge into. */
  upstream: string
  /** Git remote of the upstream repository, or `null` when it was found as the fork's parent on GitHub. */
  upstreamRemote: string | null
}

// Every command that talks to GitHub takes these, for clones whose remotes don't follow the usual names.
export const REMOTE_ARGS = {
  fork: {
    type: 'string',
    default: 'origin',
    description: 'Git remote of your fork'
  },
  upstream: {
    type: 'string',
    description:
      "Git remote of the upstream repository (default: `upstream`, or the fork's parent on GitHub)"
  }
} satisfies Args

// `gh repo fork` names the remotes `origin` for the fork and `upstream` for its parent, so those are the defaults.
export async function findRemotes(options: { fork: string; upstream?: string }): Promise<Remotes> {
  const fork = await readRemoteRepo(options.fork)
  if (!fork) {
    throw new Error(
      `Can't find the git remote \`${options.fork}\` of your fork. Pass \`--fork <remote>\`.`
    )
  }

  const upstreamRemote = options.upstream ?? 'upstream'
  const remoteRepo = await readRemoteRepo(upstreamRemote)
  if (remoteRepo) {
    return { fork, forkRemote: options.fork, upstream: remoteRepo, upstreamRemote }
  }

  const parent = options.upstream ? null : await findParent(fork)
  if (!parent) {
    throw new Error(`Can't find the upstream repository of ${fork}. Pass \`--upstream <remote>\`.`)
  }
  return { fork, forkRemote: options.fork, upstream: parent, upstreamRemote: null }
}

// Reads `owner/name` from the URLs GitHub hands out: HTTPS, SSH and `ssh://`.
function parseRepo(url: string): string | null {
  const match = /github\.com[/:]([^/]+\/[^/]+?)(?:\.git)?\/?$/.exec(url)
  return match?.[1] ?? null
}

async function readRemoteRepo(remote: string) {
  const url = await git('remote', 'get-url', remote).catch(() => null)
  return url ? parseRepo(url) : null
}

async function findParent(fork: string) {
  const parent = await gh(['api', `repos/${fork}`, '--jq', '.parent.full_name // ""'])
  return parent || null
}
