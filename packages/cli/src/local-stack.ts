import { findStacks } from '@forkstack/core/discovery'

import { git, readForkHead } from './git.ts'

export interface LocalBranch {
  name: string
  headOid: string
  /** Commits on the branch that the trunk doesn't have. */
  commits: string[]
  /** Every head the branch had, from its reflog and the fork, so a branch built on an older version of it still counts as above it. */
  pastHeads: string[]
}

// Nothing about a stack is stored locally. Its branches and their order come from git ancestry, the way the server orders a stack's PRs.
// Returns the stack of `branch` bottom to top, which is just `branch` when no other branch builds on it or under it.
export async function findLocalStack(
  trunkOid: string,
  branch: string,
  forkRemote: string
): Promise<LocalBranch[]> {
  const branches = await listBranches(trunkOid, forkRemote)
  const current = branches.find(other => other.name === branch)
  if (!current) {
    throw new Error(`\`${branch}\` has no commits above the trunk, so it is not in a stack.`)
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
async function listBranches(trunkOid: string, forkRemote: string): Promise<LocalBranch[]> {
  const output = await git('for-each-ref', '--format=%(refname:short) %(objectname)', 'refs/heads')
  const branches = await Promise.all(
    output
      .split('\n')
      .filter(Boolean)
      .map(async line => {
        const [name, headOid] = line.split(' ')
        // After `sync` pulls a branch forkstack rebased on GitHub, the branches above are built on the fork's copy, which was never a local head.
        const [commits, reflog, pushed] = await Promise.all([
          git('rev-list', `${trunkOid}..${headOid}`),
          git('reflog', 'show', '--format=%H %gs', `refs/heads/${name}`).catch(() => ''),
          readForkHead(forkRemote, name)
        ])
        return {
          name,
          headOid,
          commits: lines(commits),
          pastHeads: [...readPastHeads(reflog), ...(pushed ? [pushed] : [])]
        }
      })
  )
  return branches.filter(branch => branch.commits.length > 0)
}

// A branch starts at the head of the branch it was created from. That head is the parent's, so it would put the parent above this branch once the parent gets new commits.
function readPastHeads(reflog: string) {
  return lines(reflog)
    .filter(line => !line.includes(' branch: Created from '))
    .map(line => line.split(' ')[0])
}

function lines(output: string) {
  return output.split('\n').filter(Boolean)
}
