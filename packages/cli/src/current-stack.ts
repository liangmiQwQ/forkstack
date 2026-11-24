import { getStack, listStacks } from './api.ts'
import type { Stack } from './api.ts'
import { findOpenPr } from './github.ts'
import type { PrRef } from './github.ts'
import type { Remotes } from './remotes.ts'

// The server is the source of truth for stacks, so a branch's stack is found through its open PR.
export async function findBranchStack(remotes: Remotes, branch: string): Promise<Stack> {
  const pr = await findOpenPr(remotes, branch)
  if (!pr) {
    throw new Error(
      `\`${branch}\` has no open PR in ${remotes.upstream}. Run \`forkstack submit\` first.`
    )
  }

  return findPrStack(pr)
}

export async function findPrStack(pr: PrRef): Promise<Stack> {
  const stack = (await listStacks()).find(stack => stack.prIds.includes(pr.id))
  if (!stack) {
    throw new Error(
      `#${pr.number} is not in one of your forkstack stacks. Run \`forkstack submit\` first.`
    )
  }
  return getStack(stack.id)
}
