import * as v from 'valibot'
import { defineHandler } from 'void'

import { renderReviewButton } from '../../src/button.ts'

const QUERY = v.object({
  theme: v.optional(v.picklist(['light', 'dark']), 'light')
})

// Unlike the rebase button, the label never changes, so GitHub's image proxy may keep it for a day.
export const GET = defineHandler.withValidator({ query: QUERY })((c, { query }) =>
  c.body(renderReviewButton(query.theme), 200, {
    'Content-Type': 'image/svg+xml',
    'Cache-Control': 'public, max-age=86400'
  })
)
