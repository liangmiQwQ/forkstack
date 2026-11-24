import { HTTPException } from 'hono/http-exception'
import * as v from 'valibot'
import { defineHandler, defineHead } from 'void'
import type { InferProps } from 'void'
import { requireAuth } from 'void/auth'
import { env } from 'void/env'
import type { PageParams } from 'void/routes'

import { getGithubToken } from '../../../../src/account.ts'
import { fetchPrs } from '../../../../src/github.ts'
import { findOwnStack } from '../../../../src/own-stack.ts'
import { isRunning, readRestackStatus, startRestack } from '../../../../src/restack-job.ts'

export type Props = InferProps<typeof loader>

// The bot comment on every PR links here, so the page checks the visitor owns the stack before showing it.
export const loader = defineHandler(async c => {
  const user = requireAuth(c, { throwRedirect: '/login' })
  const stack = await findOwnStack(user.id, readStackId(c))

  const token = await getGithubToken(c, user.id)
  const [prs, status] = await Promise.all([
    fetchPrs(
      token,
      stack.prs.map(pr => pr.id)
    ),
    readRestackStatus(stack.id)
  ])

  return {
    stackId: stack.id,
    prs,
    status,
    running: isRunning(status),
    installUrl: `https://github.com/apps/${env.GITHUB_APP_SLUG}/installations/new`
  }
})

export const actions = {
  restack: defineHandler.withValidator({
    body: v.object({ onMain: v.boolean() })
  })(async (c, { body }) => {
    const user = requireAuth(c)
    const stack = await findOwnStack(user.id, readStackId(c))

    if (isRunning(await readRestackStatus(stack.id))) {
      throw new HTTPException(409, { message: 'This stack is being rebased already.' })
    }

    await startRestack(stack.id, body.onMain)
  })
}

export const head = defineHead(() => ({ title: 'Rebase stack' }))

function readStackId(c: Parameters<typeof loader>[0]) {
  return (c.req.param() as PageParams<'/stacks/[id]/restack'>).id
}
