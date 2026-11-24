import { kv } from 'void/kv'

import { restack } from './restack.ts'
import type { RestackResult } from './restack.ts'
import { clearStackPrs } from './stack-status.ts'
import { getStack } from './stack.ts'

type RestackStatus = (RestackResult | { state: 'failed' }) & {
  /** ISO timestamp of the last change. */
  at: string
}

// Only the latest restack of each stack is shown, and a day is long enough to come back for the result.
const TTL_SECONDS = 24 * 60 * 60

const statusByStack = kv.map<RestackStatus>('restack-status')

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

async function saveStatus(stackId: string, status: RestackResult | { state: 'failed' }) {
  await statusByStack.put(
    stackId,
    { ...status, at: new Date().toISOString() },
    { ttl: TTL_SECONDS }
  )
}
