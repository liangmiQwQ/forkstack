import { HTTPException } from 'hono/http-exception'
import * as v from 'valibot'
import { defineHandler } from 'void'

import { linkStack } from '../../../src/stack-link.ts'
import { listStacks } from '../../../src/stack.ts'
import { requireTokenUser } from '../../../src/token-user.ts'

const PR_IDS = v.pipe(v.array(v.string()), v.minLength(2))

const BODY = v.object({ prIds: PR_IDS })

// Lists the caller's stacks as PR node IDs, bottom to top, so the CLI can find the stack a branch belongs to.
export const GET = defineHandler(async c => {
  const { userId } = await requireTokenUser(c)
  const stacks = await listStacks(userId)
  return stacks.map(stack => ({ id: stack.id, prIds: stack.prs.map(pr => pr.id) }))
})

export const POST = defineHandler.withValidator({ body: BODY })(async (c, { body }) => {
  const { userId, token } = await requireTokenUser(c)
  const id = await linkStack(userId, token, body.prIds)
  if (!id) {
    throw new HTTPException(409, {
      message: 'GitHub does not show these PRs as one stack, or one is in another stack already.'
    })
  }

  return c.json({ id }, 201)
})
