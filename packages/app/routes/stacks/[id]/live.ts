import { defineHandler } from 'void'
import type { CloudContext } from 'void'
import { requireAuth } from 'void/auth'

import { findOwnStack } from '../../../src/own-stack.ts'
import { readRestackStatus } from '../../../src/restack-job.ts'
import { publishStatus, restackLive } from '../../../src/restack-live.ts'

async function ownedStackId(c: CloudContext) {
  const user = requireAuth(c)
  const stack = await findOwnStack(user.id, c.req.param('id')!)
  return stack.id
}

export const GET = defineHandler(async c =>
  restackLive.connect(c, { owner: await ownedStackId(c) })
)

export const POST = defineHandler(async c => {
  const owner = await ownedStackId(c)
  const response = await restackLive.control(c, { owner })
  if (response.ok) {
    // Subscribe first, then send the current result to cover missed events on load or reconnect.
    const status = await readRestackStatus(owner)
    if (status) {
      await publishStatus(owner, status)
    }
  }
  return response
})
