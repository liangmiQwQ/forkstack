import { define } from 'gunshi'
import c from 'picocolors'

import { getStack } from '../api.ts'
import type { Stack } from '../api.ts'
import { findPrStack } from '../current-stack.ts'
import { git } from '../git.ts'
import { findPrRef } from '../github.ts'
import { findRemotes, REMOTE_ARGS } from '../remotes.ts'
import type { Remotes } from '../remotes.ts'

// Stack IDs are UUIDs, and PR numbers never look like one.
const STACK_ID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i
const PR_URL = /github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/
const PR_NUMBER = /^#?(\d+)$/

export const checkout = define({
  name: 'checkout',
  description: 'Fetch every branch of a stack from your fork and check out the top one',
  args: {
    ...REMOTE_ARGS,
    target: {
      type: 'positional',
      description: 'A PR URL or number in the stack, or the stack ID'
    }
  },
  run: async ctx => {
    const remotes = await findRemotes(ctx.values)
    const stack = await findStack(remotes, ctx.values.target)

    // Merged PRs stay in the stack until it restacks, but their branches may be deleted already.
    const open = stack.prs.filter(pr => pr.state === 'OPEN')
    if (open.some(pr => pr.headRepo?.toLowerCase() !== remotes.fork.toLowerCase())) {
      throw new Error(`The stack's branches are not in ${remotes.fork}. Pass \`--fork <remote>\`.`)
    }

    const refs = open.map(pr => pr.headRef)
    await git(
      'fetch',
      '--quiet',
      remotes.forkRemote,
      ...refs.map(ref => `+refs/heads/${ref}:refs/remotes/${remotes.forkRemote}/${ref}`)
    )
    for (const ref of refs) {
      await updateBranch(ref, `${remotes.forkRemote}/${ref}`)
    }

    const top = refs.at(-1)!
    await git('checkout', '--quiet', top)
    console.log(`Switched to ${c.cyan(top)}, the top of ${refs.length} branches`)
  }
})

async function findStack(remotes: Remotes, target: string): Promise<Stack> {
  if (STACK_ID.test(target)) {
    return getStack(target)
  }

  const url = PR_URL.exec(target)
  const number = url?.[2] ?? PR_NUMBER.exec(target)?.[1]
  if (!number) {
    throw new Error(`\`${target}\` is not a PR URL, a PR number or a stack ID.`)
  }

  return findPrStack(await findPrRef(url?.[1] ?? remotes.upstream, Number(number)))
}

// Local commits that were never pushed would be lost by a reset, so a branch that moved apart is left as it is.
async function updateBranch(ref: string, remoteRef: string) {
  const local = await git('rev-parse', '--verify', '--quiet', `refs/heads/${ref}`).catch(() => null)
  if (!local) {
    await git('branch', '--quiet', '--track', ref, remoteRef)
    return
  }

  const isBehind = await git('merge-base', '--is-ancestor', local, remoteRef)
    .then(() => true)
    .catch(() => false)
  if (!isBehind) {
    console.warn(
      c.yellow(`\`${ref}\` has commits that are not in your fork, so it was left as is.`)
    )
    return
  }
  // `git branch -f` refuses to move the checked-out branch, while a fast-forward merge moves it with the files.
  const isCurrent = (await git('branch', '--show-current')) === ref
  await (isCurrent
    ? git('merge', '--quiet', '--ff-only', remoteRef)
    : git('branch', '--force', ref, remoteRef))
}
