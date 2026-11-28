import { expect, it } from 'vite-plus/test'

import { allowsMaintainerEdits, countMerged } from '../src/stack-health.ts'

it('counts merged PRs at the bottom, and calls a stack merged out of order or closed broken', () => {
  expect(countMerged(['MERGED', 'MERGED', 'OPEN'])).toBe(2)
  expect(countMerged(['OPEN', 'MERGED', 'OPEN'])).toBeNull()
  expect(countMerged(['MERGED', 'CLOSED', 'OPEN'])).toBeNull()
})

it('lets maintainers rebase only when every open PR allows edits, ignoring merged ones', () => {
  const merged = { state: 'MERGED', maintainerCanModify: false } as const
  const allowed = { state: 'OPEN', maintainerCanModify: true } as const
  const denied = { state: 'OPEN', maintainerCanModify: false } as const

  expect(allowsMaintainerEdits([merged, allowed, allowed])).toBe(true)
  expect(allowsMaintainerEdits([allowed, denied])).toBe(false)
})
