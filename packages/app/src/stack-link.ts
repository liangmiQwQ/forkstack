import { discoverStacks } from '@forkstack/core/discovery'
import type { PullRequest } from '@forkstack/core/discovery'
import { env } from 'void/env'

import { requireForkAdmin } from './fork-admin.ts'
import { fetchPrs, searchOpenPrs } from './github.ts'
import { requirePushHook } from './push-hook.ts'
import { addCachedSavedPrs } from './stack-cache.ts'
import { markPrs, syncMarkers, unmarkPrs } from './stack-markers.ts'
import { createStack, deleteStack, listStacks, removePrs, replaceStackPrs } from './stack.ts'
import type { StoredStack } from './stack.ts'

// Shared by the "Find stacks" page and the CLI's API, so both save stacks the same way.
// Returns the stack's ID, or `null` when GitHub doesn't show these PRs as a stack, in this order.
// Adding a PR to a stack that is already saved keeps that stack's ID.
// `origin` is this deployment's, where the fork's push webhook delivers.
export async function linkStack(
  userId: string,
  token: string,
  prIds: string[],
  origin: string
): Promise<string | null> {
  // The stack is found again from GitHub, so only the user's own PRs are saved, in the order their commits show.
  const [prs, saved] = await Promise.all([searchOpenPrs(token), listStacks(userId)])
  const stack = discoverStacks(prs).find(
    stack => stack.map(pr => pr.id).join(',') === prIds.join(',')
  )
  const fork = stack?.[0].headRepo
  if (!stack || !fork) {
    return null
  }

  // Checked on every binding, even with a hook in place, and before anything is saved or posted, so a failed setup leaves the stack unbound.
  await requireForkAdmin(token, fork)
  await requirePushHook(userId, fork, origin)

  const overlapping = saved.filter(existing => sharesPr(existing, stack))
  // A PR can only be in one stack. Two saved stacks claiming these PRs is left for the caller to sort out.
  // An archived stack is a finished record, so a new group of PRs does not reopen it.
  if (overlapping.length > 1 || (overlapping.length === 1 && overlapping[0].archivedAt)) {
    return null
  }

  if (overlapping.length === 1) {
    const existing = overlapping[0]
    if (existing.prs.map(pr => pr.id).join(',') === prIds.join(',')) {
      return existing.id
    }
    return extendStack(userId, existing, stack)
  }

  // The database is saved first, since it is the source of truth, then the markers go on GitHub.
  const id = await createStack(userId, stack)
  await markPrs(stack, id)
  // The dashboard renders the new stack from the cache before GitHub answers.
  await addCachedSavedPrs(userId, stack)
  return id
}

async function extendStack(
  userId: string,
  existing: StoredStack,
  stack: PullRequest[]
): Promise<string> {
  const nextIds = new Set(stack.map(pr => pr.id))
  const removed = existing.prs.filter(pr => !nextIds.has(pr.id))
  // The row is updated, not deleted, so a failed marker write still leaves the original URL working.
  await replaceStackPrs(existing, stack)
  await unmarkPrs(removed)
  await markPrs(stack, existing.id)
  await addCachedSavedPrs(userId, stack)
  return existing.id
}

function sharesPr(existing: StoredStack, stack: PullRequest[]) {
  const ids = new Set(stack.map(pr => pr.id))
  return existing.prs.some(pr => ids.has(pr.id))
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
