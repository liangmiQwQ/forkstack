import { expect, it } from 'vite-plus/test'

import { renderComment } from '../src/marker.ts'
import { pr } from './fixtures.ts'

it('tells agents which branch range to review and which PRs hold the rest of the stack', () => {
  const stack = [pr(1), pr(2), pr(3)]

  const comment = renderComment('stack', stack, 1)
  const guide = comment.slice(comment.indexOf('<!-- forkstack-agent'))

  expect(guide).toContain('`branch-1..branch-2`')
  expect(guide).toContain('(#3) build on this PR')
  expect(guide.trimEnd().endsWith('-->')).toBe(true)
})

it('lists the stack top first, above its base branch', () => {
  const stack = [pr(1), pr(2), pr(3)]

  const comment = renderComment('stack', stack, 1)

  expect(comment).toContain('> - #3\n> - #2 (this PR)\n> - #1\n> - `main`')
})

it('tells readers the author rebases from the stack page', () => {
  const comment = renderComment('stack', [pr(1), pr(2)], 0)

  expect(comment).toContain("> The stack's author can rebase it from the stack page.")
})
