import { expect, it } from 'vite-plus/test'

import { findStacks, groupCandidates, isManaged } from '../src/discovery.ts'
import { renderComment } from '../src/marker.ts'
import { pr, url } from './fixtures.ts'

it('groups fork PRs that share a base branch and a head fork', () => {
  const groups = groupCandidates([
    pr(1),
    pr(2),
    pr(3, { baseRef: 'release' }),
    pr(4, { headRepo: 'upstream/repo' }),
    pr(5, { headRepo: null })
  ])

  expect(groups.map(group => group.map(item => item.number))).toEqual([[1, 2]])
})

it('orders a stack bottom to top and leaves unrelated PRs out', () => {
  const bottom = pr(1)
  const middle = pr(2, { commits: ['oid-1', 'oid-2'] })
  const top = pr(3, { commits: ['oid-1', 'oid-2', 'oid-3'] })
  const unrelated = pr(4)

  const stacks = findStacks([top, unrelated, bottom, middle])

  expect(stacks).toEqual([[bottom, middle, top]])
})

it("keeps a layer above its parent after the parent was amended, through the parent's past heads", () => {
  // The middle branch was created at the bottom's old head, which it still contains, so that past head points the other way.
  const bottom = {
    ...pr(1, { headOid: 'oid-1b', commits: ['oid-1b'] }),
    pastHeads: ['oid-1b', 'oid-1']
  }
  const middle = { ...pr(2, { commits: ['oid-1', 'oid-2'] }), pastHeads: ['oid-2', 'oid-1'] }
  const top = { ...pr(3, { commits: ['oid-1', 'oid-2', 'oid-3'] }), pastHeads: ['oid-3', 'oid-2'] }

  expect(findStacks([top, bottom, middle])).toEqual([[bottom, middle, top]])
})

it('prefers the child built on the current head over one built on a past head', () => {
  const layer = {
    ...pr(1, { headOid: 'oid-1b', commits: ['oid-1', 'oid-1b'] }),
    pastHeads: ['oid-1']
  }
  const abandoned = {
    ...pr(2, { headOid: 'oid-old', commits: ['oid-1', 'oid-old'] }),
    pastHeads: []
  }
  const next = { ...pr(3, { commits: ['oid-1', 'oid-1b', 'oid-3'] }), pastHeads: ['oid-3'] }

  expect(findStacks([abandoned, layer, next])).toEqual([[layer, next]])
})

it('still skips a layer when every child sits on a past head', () => {
  const layer = {
    ...pr(1, { headOid: 'oid-1b', commits: ['oid-1b'] }),
    pastHeads: ['oid-1']
  }
  const left = { ...pr(2, { commits: ['oid-1', 'oid-a'] }), pastHeads: [] }
  const right = { ...pr(3, { commits: ['oid-1', 'oid-b'] }), pastHeads: [] }

  expect(findStacks([layer, left, right])).toEqual([])
})

it('skips stacks that branch into more than one PR', () => {
  const group = [
    pr(1),
    pr(2, { commits: ['oid-1', 'oid-2'] }),
    pr(3, { commits: ['oid-1', 'oid-3'] })
  ]

  expect(findStacks(group)).toEqual([])
})

it('treats a stack as managed when any of its PRs has a bot comment with a forkstack marker', () => {
  const stack = [pr(1), pr(2)]
  const managed = new Map([[url(2), ['Thanks!', renderComment('stack', stack, 1)]]])
  const unmanaged = new Map([[url(1), ['Thanks!']]])

  expect(isManaged(stack, managed)).toBe(true)
  expect(isManaged(stack, unmanaged)).toBe(false)
})
