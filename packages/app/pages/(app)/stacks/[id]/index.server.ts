import { findReviewUrl } from '@forkstack/core/review'
import { HTTPException } from 'hono/http-exception'
import { defineHandler, defineHead } from 'void'
import type { InferProps } from 'void'
import { getUser } from 'void/auth'
import type { PageParams } from 'void/routes'

import { readRestackStatus, restackIfMerged } from '../../../../src/restack-job.ts'
import { describeStack } from '../../../../src/stack-notice.ts'
import { fetchRebaseOptions, fetchStackPrs } from '../../../../src/stack-status.ts'
import { getStack } from '../../../../src/stack.ts'

export type Props = InferProps<typeof loader>

// The bot comment on every PR links here, so anyone can view the stack and its rebase state, signed in or not, and only its owner can rebase it.
export const loader = defineHandler(async c => {
  const stackId = (c.req.param() as PageParams<'/stacks/[id]'>).id
  const [stack, prs] = await Promise.all([getStack(stackId), fetchStackPrs(stackId)])
  if (!stack || !prs) {
    throw new HTTPException(404, { message: 'This stack does not exist.' })
  }

  // Each view reads the PRs anyway, so it checks for a merge the notifications missed for free.
  await restackIfMerged(stackId, prs)
  const [options, status] = await Promise.all([
    fetchRebaseOptions(stack),
    readRestackStatus(stackId)
  ])

  return {
    stackId,
    prs: prs.map(pr => ({ ...pr, reviewUrl: findReviewUrl(prs, pr.id) })),
    notice: describeStack(prs, options, status),
    canRebase: getUser()?.id === stack.userId
  }
})

export const head = defineHead(() => ({ title: 'Stack' }))
