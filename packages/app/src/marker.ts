// Every PR managed by forkstack carries a bot comment with this HTML comment, so stacks can be found from GitHub alone.
export const MARKER = '<!-- forkstack'

export function renderComment(stackId: string): string {
  return `This pull request is part of a stack managed by [forkstack](https://forkstack.dev).\n\n${MARKER}:stack=${stackId} -->`
}
