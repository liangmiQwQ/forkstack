import type { PullRequest } from './discovery.ts'

// GitHub's diff of a PR contains every PR below it, since a fork branch can't be the base of an upstream PR.
// Its `files/<from>..<to>` view leaves out the commits up to `<from>`, so starting at the parent's head shows only this PR's changes.
export function findReviewUrl(stack: PullRequest[], prId: string): string | null {
  const index = stack.findIndex(pr => pr.id === prId)
  if (index === -1) {
    return null
  }

  const pr = stack[index]
  if (index === 0) {
    return `${pr.url}/files`
  }

  const parent = stack[index - 1]
  // The parent's head can leave the branch, such as after the parent was squash-merged and this PR rebased. The whole diff is then its own.
  if (!pr.commits.includes(parent.headOid)) {
    return `${pr.url}/files`
  }

  return `${pr.url}/files/${parent.headOid}..${pr.headOid}`
}
