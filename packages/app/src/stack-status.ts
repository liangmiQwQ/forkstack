import type { PullRequest } from '@forkstack/core/discovery'
import { env } from 'void/env'
import { kv } from 'void/kv'

import { fetchPrs } from './github.ts'
import { checkSigningKey, readRebaseOptions } from './restack.ts'
import type { RebaseOptions } from './restack.ts'
import { getStack } from './stack.ts'
import type { StoredStack } from './stack.ts'

// Anyone who opens the stack page or a review link reads GitHub through the bot's shared token, so a short cache keeps it under GitHub's rate limit.
// 60 seconds is also the shortest TTL Cloudflare KV accepts.
const TTL_SECONDS = 60

const prsByStack = kv.map<PullRequest[]>('stack-status')
const optionsByStack = kv.map<RebaseOptions>('rebase-options')

// Returns the stack's PRs bottom to top, or `null` when the stack does not exist.
export function fetchStackPrs(stackId: string): Promise<PullRequest[] | null> {
  return readThrough(prsByStack, stackId, async () => {
    const stack = await getStack(stackId)
    // The bot reads the PRs, since these requests come from anyone viewing the PR, not from a signed-in user.
    return (
      stack &&
      fetchPrs(
        env.GITHUB_BOT_TOKEN,
        stack.prs.map(pr => pr.id)
      )
    )
  })
}

// Only for showing the state: starting a rebase reads GitHub again, since a cached state may be a minute old.
export async function fetchRebaseOptions(stack: StoredStack): Promise<RebaseOptions> {
  const options = await readThrough(optionsByStack, stack.id, () =>
    readRebaseOptions(stack.prs.map(pr => pr.id))
  )
  return checkSigningKey(options, stack.userId)
}

// Called whenever forkstack learns the branches moved.
export async function clearStackStatus(stackId: string): Promise<void> {
  await Promise.all([prsByStack.delete(stackId), optionsByStack.delete(stackId)])
}

// `null` means there is nothing to read, so it is not cached.
async function readThrough<T>(
  map: ReturnType<typeof kv.map<NonNullable<T>>>,
  key: string,
  load: () => Promise<T>
): Promise<T> {
  const cached = await map.get(key)
  if (cached) {
    return cached
  }

  const value = await load()
  if (value !== null && value !== undefined) {
    await map.put(key, value, { ttl: TTL_SECONDS })
  }
  return value
}
