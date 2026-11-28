import type { LayerPlan } from '@forkstack/core/restack-plan'

import { git } from './git.ts'

// Dropping a merge of the parent must not drop edits recorded only in it, such as a conflict resolution.
// So the layer's own commits are replayed onto the parent commit it merged, which has to give back the branch's tree.
// Returns the replayed head, which the rest of the rebase moves like any linear layer. HEAD is left detached.
export async function flattenLayer(
  plan: LayerPlan,
  { merge, tip }: NonNullable<LayerPlan['flatten']>
): Promise<string> {
  await git('checkout', '--quiet', '--detach', tip)
  if (plan.commits.length > 0) {
    // A commit can end up empty on the parent commit, and is still kept so the tree check decides.
    const picked = await git(
      'cherry-pick',
      '--keep-redundant-commits',
      ...plan.commits.map(commit => commit.oid)
    ).catch(() => null)
    if (picked === null) {
      throw new Error(await describeConflict(plan.ref, merge))
    }
  }

  if (
    (await git('rev-parse', 'HEAD^{tree}')) !== (await git('rev-parse', `${plan.headOid}^{tree}`))
  ) {
    throw new Error(
      `Merge ${merge.slice(0, 7)} in \`${plan.ref}\` holds edits of its own, which flattening would drop. Rebase it by hand.`
    )
  }
  return git('rev-parse', 'HEAD')
}

// Reads where the cherry-pick stopped, then aborts it so no branch has moved.
async function describeConflict(ref: string, merge: string) {
  const commit = await git('rev-parse', '--short', 'CHERRY_PICK_HEAD')
  const files = await git('diff', '--name-only', '--diff-filter=U')
  await git('cherry-pick', '--abort')
  return `Without merge ${merge.slice(0, 7)}, commit ${commit} in \`${ref}\` conflicts in ${files.split('\n').join(', ')}. The merge holds a conflict resolution, so rebase it by hand.`
}
