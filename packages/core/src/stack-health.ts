import type { PullRequest } from './discovery.ts'

// A stack merges bottom first, so it is healthy while its merged PRs all sit below the open ones.
// Returns how many PRs at the bottom are merged, or `null` when the stack is broken: a PR was closed, or merged above an open one.
// Forkstack can't tell where a broken stack should go, so the user rebases it by hand and creates the stack again.
export function countMerged(states: PullRequest['state'][]): number | null {
  const merged = states.findIndex(state => state !== 'MERGED')
  if (merged === -1) {
    return states.length
  }

  return states.slice(merged).every(state => state === 'OPEN') ? merged : null
}

// Maintainers may rebase only with the author's consent, which is "Allow edits by maintainers" on every open PR.
// Only open PRs count, since merged ones just mark where the layers above them start.
// GitHub never offers the setting on forks owned by an organization, so those stacks stay with their author.
export function allowsMaintainerEdits(
  prs: { state: PullRequest['state']; maintainerCanModify: boolean }[]
): boolean {
  return prs.every(pr => pr.state !== 'OPEN' || pr.maintainerCanModify)
}
