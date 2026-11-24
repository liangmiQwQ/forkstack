import * as v from 'valibot'
import { defineHandler } from 'void'

import { fetchPrs } from '../../../../src/github.ts'
import { findOwnStack } from '../../../../src/own-stack.ts'
import { unlinkStack } from '../../../../src/stack-link.ts'
import { requireTokenUser } from '../../../../src/token-user.ts'

const PARAMS = v.object({ id: v.string() })

export const GET = defineHandler.withValidator({ params: PARAMS })(async (c, { params }) => {
  const { userId, token } = await requireTokenUser(c)
  const stack = await findOwnStack(userId, params.id)

  const prs = await fetchPrs(
    token,
    stack.prs.map(pr => pr.id)
  )
  return { id: stack.id, prs }
})

// The PRs stay open on GitHub. Only the stack and its bot comments go away.
export const DELETE = defineHandler.withValidator({ params: PARAMS })(async (c, { params }) => {
  const { userId } = await requireTokenUser(c)
  await unlinkStack(await findOwnStack(userId, params.id))
})
