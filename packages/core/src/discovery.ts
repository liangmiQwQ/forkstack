import { MARKER } from './marker.ts'

export interface PullRequest {
  /** GitHub's GraphQL node ID. */
  id: string
  number: number
  title: string
  url: string
  /** `owner/name` of the repository the PR merges into. */
  baseRepo: string
  baseRef: string
  /** `owner/name` of the repository the PR's branch lives in, or `null` when that repository was deleted. */
  headRepo: string | null
  headRef: string
  headOid: string
  /** Hashes of the commits on the PR's branch. */
  commits: string[]
  state: 'OPEN' | 'CLOSED' | 'MERGED'
  isDraft: boolean
  /** `null` when the base branch does not require reviews. */
  reviewDecision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null
  /** ISO timestamp of the PR's last update. */
  updatedAt: string
  comments: number
  /** Combined result of the head commit's checks, or `null` when it has none. */
  checks: 'passing' | 'failing' | 'running' | null
}

/** Bodies of the bot's comments on each PR, keyed by PR URL since numbers repeat across repositories. */
export type CommentsByPr = Map<string, string[]>

export function discoverStacks(prs: PullRequest[]): PullRequest[][] {
  return groupCandidates(prs).flatMap(group => findStacks(group))
}

// Groups PRs that could form a fork stack: same base repo and branch, with branches in the same fork.
export function groupCandidates(prs: PullRequest[]): PullRequest[][] {
  const groups = new Map<string, PullRequest[]>()

  for (const pr of prs) {
    if (!pr.headRepo || pr.headRepo === pr.baseRepo) {
      continue
    }

    const key = `${pr.baseRepo} ${pr.baseRef} ${pr.headRepo}`
    groups.set(key, [...(groups.get(key) ?? []), pr])
  }

  return [...groups.values()].filter(group => group.length >= 2)
}

/** What `findStacks` reads from a PR, so the CLI can also order local branches by their commits. */
export type Layer = Pick<PullRequest, 'headOid' | 'commits'>

// Finds stacks in a candidate group, ordered bottom to top. Branching stacks are skipped for now.
export function findStacks<T extends Layer>(group: T[]): T[][] {
  // 1. A PR sits on top of every other PR whose head commit it contains
  const ancestors = new Map(group.map(pr => [pr, findAncestors(pr, group)]))

  // 2. The nearest ancestor is the one with the most ancestors of its own
  const children = new Map<T, T[]>()
  const roots: T[] = []
  for (const pr of group) {
    const parent = ancestors
      .get(pr)!
      .toSorted((a, b) => ancestors.get(b)!.length - ancestors.get(a)!.length)
      .at(0)

    if (parent) {
      children.set(parent, [...(children.get(parent) ?? []), pr])
    } else {
      roots.push(pr)
    }
  }

  // 3. Walk each root upward, keeping only straight chains of two or more PRs
  return roots.map(root => walkChain(root, children)).filter(chain => chain !== null)
}

export function isManaged(stack: PullRequest[], comments: CommentsByPr): boolean {
  return stack.some(pr => comments.get(pr.url)?.some(body => body.includes(MARKER)))
}

function findAncestors<T extends Layer>(pr: T, group: T[]) {
  const own = new Set(pr.commits)
  return group.filter(other => other !== pr && own.has(other.headOid))
}

function walkChain<T>(root: T, children: Map<T, T[]>) {
  const chain = [root]

  for (let next = children.get(root); next; next = children.get(chain.at(-1)!)) {
    if (next.length > 1) {
      return null
    }
    chain.push(next[0])
  }

  return chain.length >= 2 ? chain : null
}
