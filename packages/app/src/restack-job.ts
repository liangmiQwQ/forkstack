import { kv } from 'void/kv'
import { queues } from 'void/queues'

import { restack } from './restack.ts'
import type { RestackResult } from './restack.ts'
import { clearStackPrs } from './stack-status.ts'
import { getStack } from './stack.ts'

type RestackOutcome = RestackResult | { state: 'running' } | { state: 'failed' }

export type RestackStatus = RestackOutcome & {
  /** ISO timestamp of the last change. */
  at: string
}

// Only the latest restack of each stack is shown, and a day is long enough to come back for the result.
const TTL_SECONDS = 24 * 60 * 60

// A restack whose worker died never reports back, so after this long it no longer blocks a new one.
const STALE_MS = 15 * 60 * 1000

const statusByStack = kv.map<RestackStatus>('restack-status')

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
    await saveStatus(stackId, result)
  } catch (error) {
    await saveStatus(stackId, { state: 'failed' })
    throw error
  } finally {
    // The branches moved, so the status image should read GitHub again.
    await clearStackPrs(stackId)
  }
}

async function saveStatus(stackId: string, status: RestackOutcome) {
  await statusByStack.put(
    stackId,
    { ...status, at: new Date().toISOString() },
    { ttl: TTL_SECONDS }
  )
}
