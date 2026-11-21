import { kv } from 'void/kv'

import type { PullRequest } from './discovery.ts'

// The cache only fills the first screen until fresh stacks arrive, so stale entries are harmless and a week covers most return visits.
const TTL_SECONDS = 7 * 24 * 60 * 60

const stacksByUser = kv.map<PullRequest[][]>('stacks')

export function readCachedStacks(userId: string): Promise<PullRequest[][] | null> {
  return stacksByUser.get(userId)
}

export async function cacheStacks(userId: string, stacks: PullRequest[][]): Promise<void> {
  await stacksByUser.put(userId, stacks, { ttl: TTL_SECONDS })
}
