import { discoverStacks } from '@forkstack/core/discovery'
import type { PullRequest } from '@forkstack/core/discovery'

import { searchOpenPrs } from './github.ts'
import { addCachedSavedPrs } from './stack-cache.ts'
import { markPrs, unmarkPrs } from './stack-markers.ts'
import { createStack, deleteStack, listStacks } from './stack.ts'
import type { StoredStack } from './stack.ts'

// Shared by the "Find stacks" page and the CLI's API, so both save stacks the same way.
// Returns the new stack's ID, or `null` when GitHub doesn't show these PRs as a stack, in this order.
export async function linkStack(
  userId: string,
  token: string,
  prIds: string[]
): Promise<string | null> {
  // The stack is found again from GitHub, so only the user's own PRs are saved, in the order their commits show.
  const [prs, saved] = await Promise.all([searchOpenPrs(token), listStacks(userId)])
  const stack = excludeSaved(discoverStacks(prs), saved).find(
    stack => stack.map(pr => pr.id).join(',') === prIds.join(',')
  )
  if (!stack) {
    return null
  }

  // The database is saved first, since it is the source of truth, then the markers go on GitHub.
  const id = await createStack(userId, prIds)
  await markPrs(stack, id)
  // The dashboard renders the new stack from the cache before GitHub answers.
  await addCachedSavedPrs(userId, stack)
  return id
}

export async function unlinkStack(stack: StoredStack): Promise<void> {
  await deleteStack(stack.id)
  await unmarkPrs(stack.prs)
}

// A PR can only be in one stack, so possible stacks that share a PR with a saved stack are left out.
export function excludeSaved(stacks: PullRequest[][], saved: StoredStack[]): PullRequest[][] {
  const savedIds = new Set(saved.flatMap(stack => stack.prs.map(pr => pr.id)))
  return stacks.filter(stack => !stack.some(pr => savedIds.has(pr.id)))
}
