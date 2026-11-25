import { findReviewUrl } from '@forkstack/core/review'
import { HTTPException } from 'hono/http-exception'
import { defineHandler, defineHead } from 'void'
import type { InferProps } from 'void'
import { getUser } from 'void/auth'
import type { PageParams } from 'void/routes'

import { readRestackStatus, restackIfMerged } from '../../../../src/restack-job.ts'
import { describeStack } from '../../../../src/stack-notice.ts'
import { fetchStackPrs } from '../../../../src/stack-status.ts'
import { getStack } from '../../../../src/stack.ts'

export type Props = InferProps<typeof loader>

// The bot comment on every PR links here, so anyone can view the stack, signed in or not, and only its owner sees the rebase controls.
export const loader = defineHandler(async c => {
  const stackId = (c.req.param() as PageParams<'/stacks/[id]'>).id
  const [stack, prs] = await Promise.all([getStack(stackId), fetchStackPrs(stackId)])
  if (!stack || !prs) {
    throw new HTTPException(404, { message: 'This stack does not exist.' })
  }

  // Each view reads the PRs anyway, so it checks for a merge the notifications missed for free.
  await restackIfMerged(stackId, prs)
  const isOwner = getUser()?.id === stack.userId

  return {
    stackId,
    prs: prs.map(pr => ({ ...pr, reviewUrl: findReviewUrl(prs, pr.id) })),
    notice: isOwner ? describeStack(prs, await readRestackStatus(stackId)) : null
  }
})

export const head = defineHead(() => ({ title: 'Stack' }))
