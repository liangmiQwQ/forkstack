import { findReviewUrl } from '@forkstack/core/review'
import { HTTPException } from 'hono/http-exception'
import { defer, defineHandler, defineHead } from 'void'
import type { InferProps } from 'void'
import { getUser } from 'void/auth'
import type { PageParams } from 'void/routes'

import { canRebase } from '../../../../src/rebase-access.ts'
import { readRestackStatus, restackIfMerged } from '../../../../src/restack-job.ts'
import { archiveIfMerged, deletionDate } from '../../../../src/stack-archive.ts'
import { syncMarkers } from '../../../../src/stack-markers.ts'
import { describeStack } from '../../../../src/stack-notice.ts'
import { fetchRebaseOptions, fetchStackPrs } from '../../../../src/stack-status.ts'
import { getStack } from '../../../../src/stack.ts'
import { getPublicProfile } from '../../../../src/user.ts'

export type Props = InferProps<typeof loader>

// The bot comment on every PR links here, so anyone can view the stack and its rebase state, signed in or not.
// Its owner can rebase it, and so can a maintainer when the PRs allow edits by maintainers.
// Only the database reads hold back the page, and the GitHub reads stream in after it shows.
export const loader = defineHandler(async c => {
  const stackId = (c.req.param() as PageParams<'/stacks/[id]'>).id
  const prsPromise = fetchStackPrs(stackId)
  const stack = await getStack(stackId)
  if (!stack) {
    throw new HTTPException(404, { message: 'This stack does not exist.' })
  }

  const user = getUser()
  return {
    stackId,
    repo: stack.repo,
    prCount: stack.prs.length,
    owner: await getPublicProfile(stack.userId),
    // Archived stacks show when they will be deleted, without waiting for GitHub.
    deletesAt: deletionDate(stack),
    signedIn: Boolean(user),
    github: defer(async () => {
      const prs = await prsPromise
      if (!prs) {
        throw new HTTPException(404, { message: 'This stack does not exist.' })
      }

      // Each view reads the PRs anyway, so it checks for a merge the notifications missed for free.
      await restackIfMerged(stackId, prs)
      await archiveIfMerged(stackId, prs)
      await syncMarkers(stackId, prs)
      const [options, status, rebasable] = await Promise.all([
        fetchRebaseOptions(stack),
        readRestackStatus(stackId),
        user ? canRebase(c, user.id, stack) : false
      ])

      return {
        prs: prs.map(pr => ({ ...pr, reviewUrl: findReviewUrl(prs, pr.id) })),
        notice: describeStack(prs, options, status),
        canRebase: rebasable
      }
    })
  }
})

export const head = defineHead<Props>((_c, { repo }) => ({
  title: `Stack · ${repo.baseRepo}`
}))
