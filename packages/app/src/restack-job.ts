import type { PullRequest } from '@forkstack/core/discovery'
import { countMerged } from '@forkstack/core/stack-health'
import { stackTable } from '@schema'
import { HTTPException } from 'hono/http-exception'
import { and, db, eq, sql } from 'void/db'
import { kv } from 'void/kv'
import { queues } from 'void/queues'

import { publishStatus } from './restack-live.ts'
import { RESTACK_TIMEOUT_MS } from './restack-status.ts'
import type { RestackStatus } from './restack-status.ts'
import { checkSigningKey, readRebaseOptions, restack } from './restack.ts'
import type { RestackResult } from './restack.ts'
import { clearStackStatus } from './stack-status.ts'
import { getStack } from './stack.ts'
import type { StoredStack } from './stack.ts'

// Only the latest result is shown, for one day.
const STATUS_TTL_MS = 24 * 60 * 60 * 1000

// Long enough that a conflict left to the user isn't retried on every check, short enough that the keys clean themselves up.
const MERGE_TTL_SECONDS = 30 * 24 * 60 * 60

// Keyed by the highest merged PR, since a restack after each merge only runs once by itself.
const restackedMerges = kv.map<true>('restacked-merge')

export async function readRestackStatus(stackId: string): Promise<RestackStatus | null> {
  const row = await db
    .select({ status: stackTable.restackStatus })
    .from(stackTable)
    .where(eq(stackTable.id, stackId))
    .get()
  const status = row?.status
  return status && Date.parse(status.at) > Date.now() - STATUS_TTL_MS ? status : null
}

// Claim the stack in one D1 write, including when two requests arrive at the same time.
async function claimRestack(stackId: string) {
  const status = { state: 'running', at: new Date().toISOString() } as const
  const cutoff = new Date(Date.now() - RESTACK_TIMEOUT_MS).toISOString()
  const column = stackTable.restackStatus
  const rows = await db
    .update(stackTable)
    .set({ restackStatus: status })
    .where(
      and(
        eq(stackTable.id, stackId),
        sql`(json_extract(${column}, '$.state') IS NOT 'running' OR json_extract(${column}, '$.at') <= ${cutoff})`
      )
    )
    .returning({ id: stackTable.id })
  return rows.length > 0 ? status : null
}

// Both manual entry points check live refs before claiming a job or writing its status.
export async function requestRestack(stack: StoredStack, onMain: boolean): Promise<boolean> {
  const options = await checkSigningKey(
    await readRebaseOptions(stack.prs.map(pr => pr.id)),
    stack.userId
  )
  if (options.problem) {
    throw new HTTPException(409, { message: options.problem })
  }
  if (!(onMain ? options.onMain : options.layersOnly)) {
    return false
  }
  if (!(await startRestack(stack.id, onMain))) {
    throw new HTTPException(409, { message: 'This stack is being rebased already.' })
  }
  return true
}

async function startRestack(stackId: string, onMain: boolean): Promise<boolean> {
  const status = await claimRestack(stackId)
  if (!status) {
    return false
  }

  try {
    await queues.restack.send({ stackId, onMain, startedAt: status.at })
  } catch (error) {
    await finishRestack(stackId, status.at, { state: 'failed' })
    throw error
  }
  await publishStatus(stackId, status)
  return true
}

// Every merge check calls this, so it does nothing unless the stack has newly merged PRs at its bottom and open ones above.
// The user only rebases by clicking otherwise, since a push alone doesn't say whether they're done changing a layer.
export async function restackIfMerged(stackId: string, prs: PullRequest[]): Promise<void> {
  const merged = countMerged(prs.map(pr => pr.state))
  if (!merged || merged === prs.length) {
    return
  }

  const mergeId = prs[merged - 1].id
  if ((await restackedMerges.get(mergeId)) || !(await startRestack(stackId, true))) {
    return
  }

  await restackedMerges.put(mergeId, true, { ttl: MERGE_TTL_SECONDS })
}

export async function runRestack(
  stackId: string,
  onMain: boolean,
  startedAt: string
): Promise<void> {
  const claim = await readRestackStatus(stackId)
  if (claim?.state !== 'running' || claim.at !== startedAt) {
    return
  }

  try {
    const stack = await getStack(stackId)
    if (!stack) {
      return
    }
    // Merged PRs stay in the stack, since they mark where the layers above them start.
    const result = await restack(
      stack.prs.map(pr => pr.id),
      onMain,
      stack.userId
    )
    await finishRestack(stackId, claim.at, result)
  } catch (error) {
    await finishRestack(stackId, claim.at, { state: 'failed' })
    throw error
  } finally {
    // The branches moved, so the stack page should read GitHub again.
    await clearStackStatus(stackId)
  }
}

async function finishRestack(
  stackId: string,
  startedAt: string,
  outcome: RestackResult | { state: 'failed' }
) {
  const status = { ...outcome, at: new Date().toISOString() }
  const rows = await db
    .update(stackTable)
    .set({ restackStatus: status })
    .where(
      and(
        eq(stackTable.id, stackId),
        eq(stackTable.restackStatus, { state: 'running', at: startedAt })
      )
    )
    .returning({ id: stackTable.id })
  if (rows.length > 0) {
    await publishStatus(stackId, status)
  }
}
