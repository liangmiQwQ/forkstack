import * as v from 'valibot'
import { defer, defineHandler, defineHead } from 'void'
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
// Only the database reads hold back the page, and the GitHub reads stream in after it shows.
export const loader = defineHandler(async c => {
  const user = requireAuth(c, { throwRedirect: '/login' })
  const stack = await findOwnStack(user.id, readStackId(c))

  // A missing GitHub sign-in sends a 401, so it is checked before the page starts streaming.
  const [token, status] = await Promise.all([
    getGithubToken(c, user.id),
    readRestackStatus(stack.id)
  ])

  return {
    stackId: stack.id,
    repo: stack.repo,
    prCount: stack.prs.length,
    status,
    expiredAt:
      status?.state === 'running' && Date.parse(status.at) + RESTACK_TIMEOUT_MS <= Date.now()
        ? status.at
        : null,
    // After an action this keeps its last value, so the page refreshes once a rebase finishes.
    github: defer(async () => {
      const [prs, options] = await Promise.all([
        fetchPrs(
          token,
          stack.prs.map(pr => pr.id)
        ),
        fetchRebaseOptions(stack)
      ])
      return { prs, options }
    }),
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
