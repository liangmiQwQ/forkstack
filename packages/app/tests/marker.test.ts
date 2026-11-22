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
