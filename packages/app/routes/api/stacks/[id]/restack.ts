import { HTTPException } from 'hono/http-exception'
import * as v from 'valibot'
import { defineHandler } from 'void'

import { findOwnStack } from '../../../../src/own-stack.ts'
import { isRunning, readRestackStatus, startRestack } from '../../../../src/restack-job.ts'
import { requireTokenUser } from '../../../../src/token-user.ts'

const PARAMS = v.object({ id: v.string() })

const BODY = v.object({ onMain: v.boolean() })

// Starts the same restack as the "Rebase the stack" page. It runs in a queue, so the response only says it started.
export const POST = defineHandler.withValidator({ params: PARAMS, body: BODY })(async (
  c,
  { params, body }
) => {
  const { userId } = await requireTokenUser(c)
  const stack = await findOwnStack(userId, params.id)

  if (isRunning(await readRestackStatus(stack.id))) {
    throw new HTTPException(409, { message: 'This stack is being rebased already.' })
  }

  await startRestack(stack.id, body.onMain)
  return c.body(null, 202)
})
