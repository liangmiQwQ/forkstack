import type { LayerPlan } from '@forkstack/core/restack-plan'

import { commitPayload, utcDate } from './commit-object.ts'
import type { Commit, Git } from './git.ts'
import type { Signer } from './signing.ts'

// GitHub has no cherry-pick API, but its merge API runs a real 3-way merge and reports conflicts.
// A commit is cherry-picked by merging it into a scratch commit that has the target's tree and the commit's own parent.
// The merge base is then that parent, so the merged tree is the target plus the commit's changes, like `git cherry-pick`.
export async function replayLayer(
  git: Git,
  scratch: string,
  onto: string,
  layer: LayerPlan,
  signer: Signer | null
): Promise<{ head: string } | { conflict: string } | { unverified: string }> {
  let head = onto
  let headTree: string | null = null

  for (const { oid, parent } of layer.commits) {
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
    if (signer) {
      const signed = await createSignedCopy(git, tree, head, commit, signer)
      if ('unverified' in signed) {
        return signed
      }
      head = signed.sha
    } else {
      head = await git.createCommit(tree, head, commit.message, commit.author)
    }
    headTree = tree
  }

  return { head }
}

// The author stays whoever wrote the change. The committer is the signer, as in a local `git rebase`, and is who GitHub checks the signature against.
async function createSignedCopy(
  git: Git,
  tree: string,
  parent: string,
  commit: Commit,
  signer: Signer
) {
  const fields = {
    tree,
    parent,
    message: commit.message,
    author: { ...commit.author, date: utcDate(commit.author.date) },
    committer: { ...signer.committer, date: utcDate(new Date()) }
  }
  return git.createSignedCommit(fields, await signer.sign(commitPayload(fields)))
}
