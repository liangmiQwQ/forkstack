import { defineLiveStream } from 'void/live'

import type { RestackStatus } from './restack-status.ts'

// The route verifies ownership and scopes the connection to this one stack.
export const restackLive = defineLiveStream({
  id: 'restack',
  onSubscribe: ({ owner, topic }) =>
    owner === topic ? undefined : new Response('Forbidden', { status: 403 })
})

export async function publishStatus(stackId: string, status: RestackStatus) {
  try {
    await restackLive.publish(stackId, status)
  } catch (error) {
    // D1 already holds the result; a notification failure must never mark the rebase as failed.
    // oxlint-disable-next-line no-console -- record delivery failures in the Worker log
    console.error('Could not publish the rebase status', stackId, error)
  }
}
