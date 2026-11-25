import * as v from 'valibot'
import { defineHandler } from 'void'

import { renderRestackButton } from '../../../src/button.ts'
import { readRestackStatus, restackIfMerged } from '../../../src/restack-job.ts'
import { describeStack } from '../../../src/stack-notice.ts'
import { fetchStackPrs } from '../../../src/stack-status.ts'

const PARAMS = v.object({ id: v.string() })

const QUERY = v.object({
  theme: v.optional(v.picklist(['light', 'dark']), 'light')
})

// GitHub's image proxy keeps images unless told not to, so `no-cache` makes each view of the PR show the stack's fresh state.
// Each view also reads the PRs anyway, so it checks for a merge the notifications missed for free.
export const GET = defineHandler.withValidator({ params: PARAMS, query: QUERY })(async (
  c,
  { params, query }
) => {
  const prs = await fetchStackPrs(params.id)
  if (!prs) {
    return c.notFound()
  }

  await restackIfMerged(params.id, prs)
  const notice = describeStack(prs, await readRestackStatus(params.id))

  return c.body(renderRestackButton(notice, query.theme), 200, {
    'Content-Type': 'image/svg+xml',
    'Cache-Control': 'no-cache'
  })
})
