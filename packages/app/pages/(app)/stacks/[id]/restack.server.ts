import * as v from 'valibot'
import { defineHandler, defineHead } from 'void'
import type { InferProps } from 'void'
import { requireAuth } from 'void/auth'
import { env } from 'void/env'
import type { PageParams } from 'void/routes'

import { getGithubToken } from '../../../../src/account.ts'
import { fetchPrs } from '../../../../src/github.ts'
import { findOwnStack } from '../../../../src/own-stack.ts'
import { readRestackStatus, requestRestack } from '../../../../src/restack-job.ts'
import { RESTACK_TIMEOUT_MS } from '../../../../src/restack-status.ts'
import { fetchRebaseOptions } from '../../../../src/stack-status.ts'

export type Props = InferProps<typeof loader>

// The bot comment on every PR links here, so the page checks the visitor owns the stack before showing it.
export const loader = defineHandler(async c => {
  const user = requireAuth(c, { throwRedirect: '/login' })
  const stack = await findOwnStack(user.id, readStackId(c))

  const token = await getGithubToken(c, user.id)
  const [prs, status, options] = await Promise.all([
    fetchPrs(
      token,
      stack.prs.map(pr => pr.id)
    ),
    readRestackStatus(stack.id),
    fetchRebaseOptions(stack)
  ])

  return {
    stackId: stack.id,
    prs,
    status,
    options,
    expiredAt:
      status?.state === 'running' && Date.parse(status.at) + RESTACK_TIMEOUT_MS <= Date.now()
        ? status.at
        : null,
    installUrl: `https://github.com/apps/${env.GITHUB_APP_SLUG}/installations/new`
  }
})

export const actions = {
  restack: defineHandler.withValidator({
    body: v.object({ onMain: v.boolean() })
  })(async (c, { body }) => {
    const user = requireAuth(c)
    const stack = await findOwnStack(user.id, readStackId(c))

    await requestRestack(stack, body.onMain)
  })
}

export const head = defineHead(() => ({ title: 'Rebase stack' }))

function readStackId(c: Parameters<typeof loader>[0]) {
  return (c.req.param() as PageParams<'/stacks/[id]/restack'>).id
}
