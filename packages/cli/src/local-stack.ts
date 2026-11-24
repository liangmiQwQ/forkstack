import { findStacks } from '@forkstack/core/discovery'

import { git } from './git.ts'

export interface LocalBranch {
  name: string
  headOid: string
  /** Commits on the branch that the trunk doesn't have. */
  commits: string[]
}

// Nothing about a stack is stored locally. Its branches and their order come from git ancestry, the way the server orders a stack's PRs.
// Returns the stack of `branch` bottom to top, which is just `branch` when no other branch builds on it or under it.
export async function findLocalStack(trunkOid: string, branch: string): Promise<LocalBranch[]> {
  const branches = await listBranches(trunkOid)
  const current = branches.find(other => other.name === branch)
  if (!current) {
    throw new Error(`\`${branch}\` has no commits of its own above the trunk.`)
  }

  const stack = findStacks(branches).find(stack => stack.includes(current))
  if (stack) {
    return stack
  }

  // `findStacks` leaves out branching stacks as well as single branches, so the two are told apart here.
  const related = branches.filter(
    other =>
      other !== current &&
      (current.commits.includes(other.headOid) || other.commits.includes(current.headOid))
  )
  if (related.length > 0) {
    const names = [current, ...related].map(other => `\`${other.name}\``).join(', ')
    throw new Error(`These branches don't form one straight stack: ${names}.`)
  }
  return [current]
}

// Branches without commits above the trunk, such as a local copy of the trunk, can't be layers.
async function listBranches(trunkOid: string): Promise<LocalBranch[]> {
  const output = await git('for-each-ref', '--format=%(refname:short) %(objectname)', 'refs/heads')
  const branches = await Promise.all(
    output
      .split('\n')
      .filter(Boolean)
      .map(async line => {
        const [name, headOid] = line.split(' ')
        const commits = await git('rev-list', `${trunkOid}..${headOid}`)
        return { name, headOid, commits: commits.split('\n').filter(Boolean) }
      })
  )
  return branches.filter(branch => branch.commits.length > 0)
}
