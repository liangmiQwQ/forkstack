import { expect, it } from 'vite-plus/test'

import { findReviewUrl } from '../src/review.ts'
import { pr, url } from './fixtures.ts'

it('links a stacked PR to the diff after its parent head, so the parent changes are left out', () => {
  const stack = [pr(1), pr(2, { commits: ['oid-1', 'oid-2'] })]

  expect(findReviewUrl(stack, 'node-2')).toBe(`${url(2)}/files/oid-1..oid-2`)
})

it('links to the whole diff once the parent head is no longer in the branch', () => {
  const stack = [
    pr(1, { state: 'MERGED' }),
    pr(2, { commits: ['rebased-oid-2'], headOid: 'rebased-oid-2' })
  ]

  expect(findReviewUrl(stack, 'node-2')).toBe(`${url(2)}/files`)
})
