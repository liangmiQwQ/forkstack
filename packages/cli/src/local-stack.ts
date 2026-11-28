import { findStacks } from '@forkstack/core/discovery'

import { COMMAND } from './command.ts'
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
  forkRemote: string,
  options: { exclude?: string[] } = {}
): Promise<LocalBranch[]> {
  return chooseStack(await listBranches(trunkOid, forkRemote), branch, options.exclude)
}

// Picks the straight stack that contains `branch`. `exclude` drops abandoned branches before that choice.
export function chooseStack(
  branches: LocalBranch[],
  branch: string,
  exclude: Iterable<string> = []
): LocalBranch[] {
  const excluded = new Set(exclude)
  if (excluded.has(branch)) {
    throw new Error(`\`${branch}\` is the current branch, so it can't be excluded.`)
  }

  const included = branches.filter(other => !excluded.has(other.name))
  const current = included.find(other => other.name === branch)
  if (!current) {
    throw new Error(`\`${branch}\` has no commits above the trunk, so it is not in a stack.`)
  }

  const stack = findStacks(included).find(stack => stack.includes(current))
  if (stack) {
    return stack
  }

  // `findStacks` leaves out branching stacks as well as single branches, so the two are told apart here.
  const related = relatedBranches(current, included)
  if (related.length > 1) {
    const names = related.map(other => `\`${other.name}\``).join(', ')
    throw new Error(
      `These branches don't form one straight stack: ${names}. A branch built on an older head of another is usually abandoned. Delete or rename it, or leave it out with \`${COMMAND} submit --exclude <branch>\`.`
    )
  }
  return [current]
}

// Branches related through a current head or a past head, so the error can name the one that splits the stack.
function relatedBranches(current: LocalBranch, branches: LocalBranch[]) {
  const related = new Set<LocalBranch>([current])
  let grew = true
  while (grew) {
    grew = false
    for (const branch of branches) {
      if (related.has(branch)) {
        continue
      }
      for (const known of related) {
        if (sharesHistory(known, branch)) {
          related.add(branch)
          grew = true
          break
        }
      }
    }
  }
  return [...related]
}

function sharesHistory(a: LocalBranch, b: LocalBranch) {
  const aCommits = new Set(a.commits)
  const bCommits = new Set(b.commits)
  return (
    aCommits.has(b.headOid) ||
    bCommits.has(a.headOid) ||
    a.pastHeads.some(oid => bCommits.has(oid)) ||
    b.pastHeads.some(oid => aCommits.has(oid))
  )
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
