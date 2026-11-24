import { env } from 'void/env'
import { kv } from 'void/kv'

import type { PullRequest } from './discovery.ts'
import { fetchPrs } from './github.ts'
import { getStack } from './stack.ts'

// Every view of a PR requests the status image through the bot's shared token, so a short cache keeps it under GitHub's rate limit.
// 60 seconds is also the shortest TTL Cloudflare KV accepts.
const TTL_SECONDS = 60

const prsByStack = kv.map<PullRequest[]>('stack-status')

// Returns the stack's PRs bottom to top, or `null` when the stack does not exist.
export async function fetchStackPrs(stackId: string): Promise<PullRequest[] | null> {
  const cached = await prsByStack.get(stackId)
  if (cached) {
    return cached
  }

  const stack = await getStack(stackId)
  if (!stack) {
    return null
  }

  // The bot reads the PRs, since these requests come from anyone viewing the PR, not from a signed-in user.
  const prs = await fetchPrs(
    env.GITHUB_BOT_TOKEN,
    stack.prs.map(pr => pr.id)
  )
  await prsByStack.put(stackId, prs, { ttl: TTL_SECONDS })
  return prs
}

export async function clearStackPrs(stackId: string): Promise<void> {
  await prsByStack.delete(stackId)
}
