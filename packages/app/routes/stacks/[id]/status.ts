import * as v from 'valibot'
import { defineHandler } from 'void'

import { fetchStackPrs } from '../../../src/stack-status.ts'
import { renderStatusImage } from '../../../src/status-image.ts'

const PARAMS = v.object({ id: v.string() })

// The number of the PR whose comment shows the image, highlighted in it.
const PR_NUMBER = v.pipe(v.string(), v.toNumber())

const QUERY = v.object({
  pr: v.optional(PR_NUMBER),
  theme: v.optional(v.picklist(['light', 'dark']), 'light')
})

// GitHub's image proxy keeps images unless told not to, so `no-cache` makes each view of the PR show fresh status.
export const GET = defineHandler.withValidator({ params: PARAMS, query: QUERY })(async (
  c,
  { params, query }
) => {
  const prs = await fetchStackPrs(params.id)
  if (!prs) {
    return c.notFound()
  }

  return c.body(renderStatusImage(prs, query.pr ?? null, query.theme), 200, {
    'Content-Type': 'image/svg+xml',
    'Cache-Control': 'no-cache'
  })
})
