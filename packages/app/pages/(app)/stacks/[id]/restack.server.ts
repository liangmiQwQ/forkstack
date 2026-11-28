import * as v from 'valibot'
import { defer, defineHandler, defineHead } from 'void'
import type { CloudContext, InferProps } from 'void'
import { requireAuth } from 'void/auth'
import type { PageParams } from 'void/routes'

import { getGithubToken, hasCurrentGrant } from '../../../../src/account.ts'
import { fetchPrs } from '../../../../src/github.ts'
import { findRebasableStack } from '../../../../src/rebase-access.ts'
import { readRestackStatus, requestRestack } from '../../../../src/restack-job.ts'
import { RESTACK_TIMEOUT_MS } from '../../../../src/restack-status.ts'
import { fetchRebaseOptions } from '../../../../src/stack-status.ts'

export type Props = InferProps<typeof loader>

// The bot comment on every PR links here, so the page checks the visitor may rebase the stack before showing it.
// Only the database reads hold back the page, and the GitHub reads stream in after it shows.
export const loader = defineHandler(async c => {
  const stackId = readStackId(c)
  const user = requireAuth(c, {
    throwRedirect: `/login?next=${encodeURIComponent(`/stacks/${stackId}/restack`)}`
  })
  const stack = await findRebasableStack(c, user.id, stackId)

  // A missing GitHub sign-in sends a 401, so it is checked before the page starts streaming.
  const isAuthor = user.id === stack.userId
  const [token, status, currentGrant] = await Promise.all([
    getGithubToken(c, user.id),
    readRestackStatus(stack.id),
    isAuthor ? hasCurrentGrant(user.id) : true
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
    // Only the author can fix their GitHub grant or signing key, so a maintainer is told to ask them.
    isAuthor,
    // A rebase onto a base that changed workflow files fails without the `workflow` scope.
    needsReauthorize: !currentGrant
  }
})

export const actions = {
  restack: defineHandler.withValidator({
    body: v.object({ onMain: v.boolean() })
  })(async (c, { body }) => {
    const user = requireAuth(c)
    const stack = await findRebasableStack(c, user.id, readStackId(c))

    await requestRestack(stack, body.onMain)
  })
}

export const head = defineHead(() => ({ title: 'Rebase stack' }))

function readStackId(c: CloudContext) {
  return (c.req.param() as PageParams<'/stacks/[id]/restack'>).id
}
