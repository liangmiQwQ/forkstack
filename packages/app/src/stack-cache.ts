import type { PullRequest } from '@forkstack/core/discovery'
import { kv } from 'void/kv'

// The cache only fills the first screen until fresh data arrives, so stale entries are harmless and a week covers most return visits.
const TTL_SECONDS = 7 * 24 * 60 * 60

const stacksByUser = kv.map<PullRequest[][]>('stacks')
const savedPrsByUser = kv.map<PullRequest[]>('saved-prs')

export function readCachedStacks(userId: string): Promise<PullRequest[][] | null> {
  return stacksByUser.get(userId)
}

export async function cacheStacks(userId: string, stacks: PullRequest[][]): Promise<void> {
  await stacksByUser.put(userId, stacks, { ttl: TTL_SECONDS })
}

export function readCachedSavedPrs(userId: string): Promise<PullRequest[] | null> {
  return savedPrsByUser.get(userId)
}

export async function cacheSavedPrs(userId: string, prs: PullRequest[]): Promise<void> {
  await savedPrsByUser.put(userId, prs, { ttl: TTL_SECONDS })
}

export async function addCachedSavedPrs(userId: string, prs: PullRequest[]): Promise<void> {
  const ids = new Set(prs.map(pr => pr.id))
  const cached = ((await readCachedSavedPrs(userId)) ?? []).filter(pr => !ids.has(pr.id))
  await cacheSavedPrs(userId, [...cached, ...prs])
}
