import { allowsMaintainerEdits } from '@forkstack/core/stack-health'
import { HTTPException } from 'hono/http-exception'
import type { CloudContext } from 'void'
import { env } from 'void/env'
import { kv } from 'void/kv'

import { getGithubToken } from './account.ts'
import { fetchMaintainerEdits, fetchViewerPermission } from './github.ts'
import { getStack } from './stack.ts'
import type { StoredStack } from './stack.ts'

// The stack page is public, so a short cache keeps maintainers' views from asking GitHub every time.
// 60 seconds is also the shortest TTL Cloudflare KV accepts.
const TTL_SECONDS = 60

const writeAccessByUser = kv.map<boolean>('write-access')

const WRITE_PERMISSIONS = new Set(['WRITE', 'MAINTAIN', 'ADMIN'])

// Stack IDs show up in every PR's bot comment, so each web rebase request checks the caller may start one.
export async function findRebasableStack(
  c: CloudContext,
  userId: string,
  stackId: string
): Promise<StoredStack> {
  const stack = await getStack(stackId)
  if (!stack || !(await canRebase(c, userId, stack))) {
    throw new HTTPException(404, {
      message: "This stack does not exist, or you can't rebase it."
    })
  }
  return stack
}

// A maintainer only starts the rebase. The GitHub App on the author's fork replays and pushes it, as it does for the author.
export async function canRebase(
  c: CloudContext,
  userId: string,
  stack: StoredStack
): Promise<boolean> {
  if (stack.userId === userId) {
    return true
  }

  // The bot reads the setting, so the visitor's token is only used for their own permission.
  const prs = await fetchMaintainerEdits(
    env.GITHUB_BOT_TOKEN,
    stack.prs.map(pr => pr.id)
  )
  return allowsMaintainerEdits(prs) && (await hasWriteAccess(c, userId, stack.repo.baseRepo))
}

async function hasWriteAccess(c: CloudContext, userId: string, repo: string): Promise<boolean> {
  const key = `${userId}:${repo}`
  const cached = await writeAccessByUser.get(key)
  if (cached !== null) {
    return cached
  }

  try {
    const token = await getGithubToken(c, userId)
    const access = WRITE_PERMISSIONS.has((await fetchViewerPermission(token, repo)) ?? '')
    await writeAccessByUser.put(key, access, { ttl: TTL_SECONDS })
    return access
  } catch {
    // No GitHub sign-in, or GitHub didn't answer. Without a reported permission, the visitor is not a maintainer.
    return false
  }
}
