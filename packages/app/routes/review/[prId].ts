import * as v from 'valibot'
import { defineHandler } from 'void'

import { findReviewUrl } from '../../src/review.ts'
import { fetchStackPrs } from '../../src/stack-status.ts'
import { findStackId } from '../../src/stack.ts'

const PARAMS = v.object({ prId: v.string() })

// The bot comment links here instead of to GitHub, since the commit range changes whenever the stack is rebased.
export const GET = defineHandler.withValidator({ params: PARAMS })(async (c, { params }) => {
  const stackId = await findStackId(params.prId)
  if (!stackId) {
    return c.notFound()
  }

  const prs = await fetchStackPrs(stackId)
  const url = prs && findReviewUrl(prs, params.prId)
  if (!url) {
    return c.notFound()
  }

  // The URL is GitHub's, built from the PR's own URL, so it skips the typed route check.
  return c.redirect(new URL(url))
})
