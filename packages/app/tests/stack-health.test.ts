import { expect, it } from 'vite-plus/test'

import { countMerged } from '../src/stack-health.ts'

it('counts merged PRs at the bottom, and calls a stack merged out of order or closed broken', () => {
  expect(countMerged(['MERGED', 'MERGED', 'OPEN'])).toBe(2)
  expect(countMerged(['OPEN', 'MERGED', 'OPEN'])).toBeNull()
  expect(countMerged(['MERGED', 'CLOSED', 'OPEN'])).toBeNull()
})
