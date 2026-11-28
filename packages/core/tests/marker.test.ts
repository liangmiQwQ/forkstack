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

it('marks the lowest open PR as next to merge', () => {
  const stack = [pr(1, { state: 'MERGED' }), pr(2), pr(3)]

  const comment = renderComment('stack', stack, 1)

  expect(comment).toContain('> [!NOTE]')
  expect(comment).toContain('> **This PR is next to merge.**')
})

it('warns that merging a higher PR also merges the open PRs below it', () => {
  const stack = [pr(12), pr(13), pr(14)]

  const comment = renderComment('stack', stack, 2)

  expect(comment).toContain('> [!WARNING]')
  expect(comment).toContain(
    "> **Don't merge this PR yet.** Merging it also merges #12 and #13. Merge #12 first."
  )
})

it('leaves a merged PR comment without a merge instruction', () => {
  const stack = [pr(1, { state: 'MERGED' }), pr(2)]

  const comment = renderComment('stack', stack, 0)

  expect(comment).toContain('> [!WARNING]')
  expect(comment).not.toContain('next to merge')
  expect(comment).not.toContain("Don't merge this PR yet")
})

it('links maintainers to the guide for merging a stack', () => {
  const comment = renderComment('stack', [pr(1), pr(2)], 0)

  expect(comment).toContain('https://forkstack.dev/docs/maintainers')
})

it('links readers directly to the rebase page for this stack', () => {
  const comment = renderComment('stack', [pr(1), pr(2)], 0)

  expect(comment).toContain('href="https://forkstack.dev/stacks/stack/restack"')
})

it('drops the links to forkstack once every PR merged, since the stack is deleted later', () => {
  const stack = [pr(1, { state: 'MERGED' }), pr(2, { state: 'MERGED' })]

  const comment = renderComment('stack', stack, 1)

  expect(comment).not.toContain('https://forkstack.dev/stacks/stack')
  expect(comment).not.toContain('https://forkstack.dev/review/')
  expect(comment).toContain('> Every PR in this stack has merged.')
})
