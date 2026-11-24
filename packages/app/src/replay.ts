import type { LayerPlan } from '@forkstack/core/restack-plan'

import type { Git } from './git.ts'

// GitHub has no cherry-pick API, but its merge API runs a real 3-way merge and reports conflicts.
// A commit is cherry-picked by merging it into a scratch commit that has the target's tree and the commit's own parent.
// The merge base is then that parent, so the merged tree is the target plus the commit's changes, like `git cherry-pick`.
export async function replayLayer(
  git: Git,
  scratch: string,
  onto: string,
  layer: LayerPlan
): Promise<{ head: string } | { conflict: string }> {
  let head = onto
  let headTree: string | null = null

  for (const [index, oid] of layer.commits.entries()) {
    const parent = index === 0 ? layer.baseOid : layer.commits[index - 1]
    // The commit already sits on the target, so it is kept as is. This leaves layers that don't move untouched.
    if (parent === head) {
      head = oid
      headTree = null
      continue
    }

    headTree ??= (await git.getCommit(head)).tree
    await git.moveBranch(scratch, await git.createCommit(headTree, parent, 'forkstack scratch'))

    const tree = await git.merge(scratch, oid)
    if (!tree) {
      return { conflict: oid }
    }

    const commit = await git.getCommit(oid)
    head = await git.createCommit(tree, head, commit.message, commit.author)
    headTree = tree
  }

  return { head }
}
