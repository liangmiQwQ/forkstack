import { env } from 'void/env'
import { kv } from 'void/kv'
import { queues } from 'void/queues'

import type { PullRequest } from './discovery.ts'
import { fetchPrs } from './github.ts'
import { restack } from './restack.ts'
import type { RestackResult } from './restack.ts'
import { countMerged } from './stack-health.ts'
import { refreshMarkers, unmarkPrs } from './stack-markers.ts'
import { clearStackPrs } from './stack-status.ts'
import { deleteStack, getStack, removePr } from './stack.ts'
import type { StoredStack } from './stack.ts'

type RestackOutcome = RestackResult | { state: 'running' } | { state: 'failed' }

export type RestackStatus = RestackOutcome & {
  /** ISO timestamp of the last change. */
  at: string
}

// Only the latest restack of each stack is shown, and a day is long enough to come back for the result.
const TTL_SECONDS = 24 * 60 * 60

// A restack whose worker died never reports back, so after this long it no longer blocks a new one.
const STALE_MS = 15 * 60 * 1000

// Long enough that a conflict left to the user isn't retried on every check, short enough that the keys clean themselves up.
const MERGE_TTL_SECONDS = 30 * 24 * 60 * 60

const statusByStack = kv.map<RestackStatus>('restack-status')

// Keyed by the highest merged PR, since a restack after each merge only runs once by itself.
const restackedMerges = kv.map<true>('restacked-merge')

export function readRestackStatus(stackId: string): Promise<RestackStatus | null> {
  return statusByStack.get(stackId)
}

export function isRunning(status: RestackStatus | null): boolean {
  return status?.state === 'running' && Date.now() - Date.parse(status.at) < STALE_MS
}

// The restack runs in a queue, since it can take more GitHub requests and time than one page request allows.
export async function startRestack(stackId: string, onMain: boolean): Promise<void> {
  await saveStatus(stackId, { state: 'running' })
  await queues.restack.send({ stackId, onMain })
}

// Every merge check calls this, so it does nothing unless the stack has newly merged PRs at its bottom and open ones above.
// The user only rebases by clicking otherwise, since a push alone doesn't say whether they're done changing a layer.
export async function restackIfMerged(stackId: string, prs: PullRequest[]): Promise<void> {
  const merged = countMerged(prs.map(pr => pr.state))
  if (!merged || merged === prs.length) {
    return
  }

  const mergeId = prs[merged - 1].id
  if ((await restackedMerges.get(mergeId)) || isRunning(await readRestackStatus(stackId))) {
    return
  }

  await restackedMerges.put(mergeId, true, { ttl: MERGE_TTL_SECONDS })
  await startRestack(stackId, true)
}

export async function runRestack(stackId: string, onMain: boolean): Promise<void> {
  const stack = await getStack(stackId)
  if (!stack) {
    return
  }

  try {
    const result = await restack(
      stack.prs.map(pr => pr.id),
      onMain
    )
    if (result.state === 'done' && result.merged.length > 0) {
      await dropMerged(stack, result.merged)
    }
    await saveStatus(stackId, result)
  } catch (error) {
    await saveStatus(stackId, { state: 'failed' })
    throw error
  } finally {
    // The branches moved, so the status image should read GitHub again.
    await clearStackPrs(stackId)
  }
}

// Merged PRs are kept until the layers above them move onto the base branch, since they mark where those layers' commits start.
// A stack needs two PRs, so one left alone is unlinked like on the dashboard.
async function dropMerged(stack: StoredStack, merged: string[]) {
  const gone = stack.prs.filter(pr => merged.includes(pr.id))
  const rest = stack.prs.filter(pr => !merged.includes(pr.id))

  if (rest.length < 2) {
    await deleteStack(stack.id)
    await unmarkPrs(stack.prs)
    return
  }

  for (const pr of gone) {
    await removePr(pr.id)
  }
  await unmarkPrs(gone)

  const prs = await fetchPrs(
    env.GITHUB_BOT_TOKEN,
    rest.map(pr => pr.id)
  )
  await refreshMarkers({ ...stack, prs: rest }, prs)
}

async function saveStatus(stackId: string, status: RestackOutcome) {
  await statusByStack.put(
    stackId,
    { ...status, at: new Date().toISOString() },
    { ttl: TTL_SECONDS }
  )
}
