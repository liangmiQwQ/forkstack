import { discoverStacks } from '@forkstack/core/discovery'
import type { PullRequest } from '@forkstack/core/discovery'
import { env } from 'void/env'

import { fetchPrs, searchOpenPrs } from './github.ts'
import { addCachedSavedPrs } from './stack-cache.ts'
import { markPrs, syncMarkers, unmarkPrs } from './stack-markers.ts'
import { createStack, deleteStack, listStacks, removePrs } from './stack.ts'
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
  const id = await createStack(userId, stack)
  await markPrs(stack, id)
  // The dashboard renders the new stack from the cache before GitHub answers.
  await addCachedSavedPrs(userId, stack)
  return id
}

// An archived stack's comments no longer link to forkstack, so they stay on the PRs as a record of the stack.
export async function unlinkStack(stack: StoredStack): Promise<void> {
  await deleteStack(stack.id)
  if (!stack.archivedAt) {
    await unmarkPrs(stack.prs)
  }
}

// A stack needs two PRs, so when fewer would be left, the whole stack is unlinked.
export async function unlinkPrs(stack: StoredStack, prIds: string[]): Promise<void> {
  const gone = stack.prs.filter(pr => prIds.includes(pr.id))
  const rest = stack.prs.filter(pr => !prIds.includes(pr.id))
  if (rest.length < 2) {
    await unlinkStack(stack)
    return
  }

  await removePrs(gone.map(pr => pr.id))
  await unmarkPrs(gone)

  // Each remaining comment lists the whole stack, so they are rewritten without the removed PRs.
  const prs = await fetchPrs(
    env.GITHUB_BOT_TOKEN,
    rest.map(pr => pr.id)
  )
  await syncMarkers(stack.id, prs)
}

// A PR can only be in one stack, so possible stacks that share a PR with a saved stack are left out.
export function excludeSaved(stacks: PullRequest[][], saved: StoredStack[]): PullRequest[][] {
  const savedIds = new Set(saved.flatMap(stack => stack.prs.map(pr => pr.id)))
  return stacks.filter(stack => !stack.some(pr => savedIds.has(pr.id)))
}
