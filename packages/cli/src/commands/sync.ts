import { define } from 'gunshi'
import c from 'picocolors'

import { COMMAND } from '../command.ts'
import { execInteractive } from '../exec.ts'
import { assertClean, currentBranch, git, isAncestor, readForkHead } from '../git.ts'
import { findPrState } from '../github.ts'
import { findLocalStack } from '../local-stack.ts'
import type { LocalBranch } from '../local-stack.ts'
import { isGitRebasing, readRebaseState } from '../rebase-state.ts'
import { findRemotes, REMOTE_ARGS } from '../remotes.ts'
import { checkoutTrunk, findTrunk } from '../trunk.ts'
import { restack } from './rebase.ts'

export const sync = define({
  name: 'sync',
  description:
    'Pull what forkstack pushed to your fork, restack local commits onto it, push, and delete merged branches',
  args: REMOTE_ARGS,
  run: async ctx => {
    if ((await readRebaseState()) || (await isGitRebasing())) {
      throw new Error('A rebase is in progress. Finish or abort it first.')
    }

    // 1. Read the stack, and fetch what forkstack or another machine pushed to the fork
    const remotes = await findRemotes(ctx.values)
    const trunk = await findTrunk(remotes, { fetch: true })
    const branch = await currentBranch()
    await assertClean()
    const stack = await findLocalStack(trunk.oid, branch, remotes.forkRemote)
    const states = await Promise.all(stack.map(layer => findPrState(remotes, layer.name)))
    const open = stack.filter((_, i) => states[i] !== 'MERGED')
    const merged = stack.filter((_, i) => states[i] === 'MERGED')
    await git('fetch', '--quiet', remotes.forkRemote)

    // 2. Bring each open branch up to the fork's copy, keeping the commits made here
    for (const layer of open) {
      if (!(await pull(layer.name, remotes.forkRemote))) {
        return
      }
    }

    // 3. Restack onto the latest trunk from an open branch, and push every branch that differs from the fork
    const target = open.some(layer => layer.name === branch) ? branch : open[0]?.name
    if (target) {
      await git('checkout', '--quiet', target)
      await restack(remotes, trunk)
      if (await readRebaseState()) {
        return
      }
    } else {
      await checkoutTrunk(remotes, trunk.branch)
      console.log(`Every PR of the stack was merged. Switched to ${c.cyan(trunk.branch)}`)
    }

    // 4. Delete the merged branches
    for (const layer of merged) {
      await deleteMerged(layer, remotes.forkRemote)
    }
  }
})

// Returns false when the rebase stopped at a conflict.
async function pull(ref: string, forkRemote: string): Promise<boolean> {
  const forkOid = await readForkHead(forkRemote, ref)
  // A branch not in the fork yet, or one with only new local commits, has nothing to pull.
  if (!forkOid || (await isAncestor(forkOid, ref))) {
    return true
  }

  // `--fork-point` reads the remote branch's reflog, so commits the fork had before forkstack force-pushed it don't count as local ones.
  const base = await git(
    'merge-base',
    '--fork-point',
    `refs/remotes/${forkRemote}/${ref}`,
    ref
  ).catch(() => null)
  if (!base) {
    throw new Error(
      `\`${ref}\` and your fork's copy have both changed, and forkstack can't tell which commits are local. Rebase it onto ${forkRemote}/${ref} by hand.`
    )
  }

  if (!(await execInteractive('git', ['rebase', '--quiet', '--onto', forkOid, base, ref]))) {
    console.error(
      c.red(
        `\nResolve the conflicts in \`${ref}\` and \`git add\` them, then run \`git rebase --continue\` and \`${COMMAND} sync\` again. Run \`git rebase --abort\` to undo.`
      )
    )
    process.exitCode = 1
    return false
  }
  console.log(`Pulled ${c.cyan(ref)} from your fork.`)
  return true
}

// A squash merge leaves the branch's commits out of the trunk, so only the fork's copy proves nothing local is lost.
async function deleteMerged(layer: LocalBranch, forkRemote: string) {
  const pushed = await readForkHead(forkRemote, layer.name)
  if (!pushed || !(await isAncestor(layer.headOid, pushed))) {
    console.warn(
      c.yellow(
        `\`${layer.name}\` was merged, but has commits that are not in your fork, so it was kept.`
      )
    )
    return
  }

  await git('branch', '--quiet', '--delete', '--force', layer.name)
  console.log(`Deleted ${c.cyan(layer.name)}, which was merged.`)
}
