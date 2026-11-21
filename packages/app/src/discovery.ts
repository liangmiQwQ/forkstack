export interface PullRequest {
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
}

/** Description of each PR, keyed by PR URL since numbers repeat across repositories. */
export type BodiesByPr = Map<string, string>

// Every PR managed by forkstack carries this HTML comment in its description, so stacks can be recovered without the database.
const MARKER = '<!-- forkstack'

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

// Finds stacks in a candidate group, ordered bottom to top. Branching stacks are skipped for now.
export function findStacks(group: PullRequest[]): PullRequest[][] {
  // 1. A PR sits on top of every other PR whose head commit it contains
  const ancestors = new Map(group.map(pr => [pr, findAncestors(pr, group)]))

  // 2. The nearest ancestor is the one with the most ancestors of its own
  const children = new Map<PullRequest, PullRequest[]>()
  const roots: PullRequest[] = []
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

export function isManaged(stack: PullRequest[], bodies: BodiesByPr): boolean {
  return stack.some(pr => bodies.get(pr.url)?.includes(MARKER))
}

function findAncestors(pr: PullRequest, group: PullRequest[]) {
  const own = new Set(pr.commits)
  return group.filter(other => other !== pr && own.has(other.headOid))
}

function walkChain(root: PullRequest, children: Map<PullRequest, PullRequest[]>) {
  const chain = [root]

  for (let next = children.get(root); next; next = children.get(chain.at(-1)!)) {
    if (next.length > 1) {
      return null
    }
    chain.push(next[0])
  }

  return chain.length >= 2 ? chain : null
}
