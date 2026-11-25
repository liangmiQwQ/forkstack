import * as v from 'valibot'
import { defineHandler } from 'void'

import { findOwnStack } from '../../../../src/own-stack.ts'
import { requestRestack } from '../../../../src/restack-job.ts'
import { requireTokenUser } from '../../../../src/token-user.ts'

const PARAMS = v.object({ id: v.string() })

const BODY = v.object({ onMain: v.boolean() })

// A queued rebase returns 202. An already aligned stack needs no job.
export const POST = defineHandler.withValidator({ params: PARAMS, body: BODY })(async (
  c,
  { params, body }
) => {
  const { userId } = await requireTokenUser(c)
  const stack = await findOwnStack(userId, params.id)

  const queued = await requestRestack(stack, body.onMain)
  return queued ? c.body(null, 202) : c.json({ state: 'up-to-date' })
})
