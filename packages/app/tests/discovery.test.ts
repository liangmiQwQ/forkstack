import { expect, it } from 'vite-plus/test'

import { findStacks, groupCandidates, isManaged } from '../src/discovery.ts'
import type { PullRequest } from '../src/discovery.ts'
import { renderComment } from '../src/marker.ts'

function pr(number: number, overrides: Partial<PullRequest> = {}): PullRequest {
  return {
    id: `node-${number}`,
    number,
    title: `PR ${number}`,
    url: url(number),
    baseRepo: 'upstream/repo',
    baseRef: 'main',
    headRepo: 'me/repo',
    headRef: `branch-${number}`,
    headOid: `oid-${number}`,
    commits: [`oid-${number}`],
    state: 'OPEN',
    isDraft: false,
    reviewDecision: null,
    updatedAt: '2026-01-01T00:00:00Z',
    comments: 0,
    checks: null,
    ...overrides
  }
}

function url(number: number) {
  return `https://github.com/upstream/repo/pull/${number}`
}

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
  const managed = new Map([[url(2), ['Thanks!', renderComment('stack')]]])
  const unmanaged = new Map([[url(1), ['Thanks!']]])

  expect(isManaged(stack, managed)).toBe(true)
  expect(isManaged(stack, unmanaged)).toBe(false)
})
