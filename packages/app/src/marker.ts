import type { PullRequest } from './discovery.ts'

// Every PR managed by forkstack carries a bot comment with this HTML comment, so stacks can be found from GitHub alone.
export const MARKER = '<!-- forkstack'

const SITE_URL = 'https://forkstack.dev'

// The comment is only rewritten when the stack's PRs change, so it only holds facts forkstack controls.
// Live PR status comes from an image forkstack draws on each view, since there are no webhooks to tell when it changes.
export function renderComment(stackId: string, stack: PullRequest[], index: number): string {
  const pr = stack[index]

  return [
    `This pull request is part of a stack managed by [forkstack](${SITE_URL}). Merge it from the bottom up.`,
    renderList(stack, index),
    `[Review only this PR's changes](${SITE_URL}/review/${pr.id})`,
    renderStatusImage(stackId, pr),
    `${MARKER}:stack=${stackId} -->`,
    renderAgentGuide(stack, index)
  ].join('\n\n')
}

// Every PR in a stack merges into the same repository, so GitHub links the short `#123` references.
function renderList(stack: PullRequest[], index: number) {
  return stack
    .map((pr, i) =>
      i === index ? `${i + 1}. **#${pr.number}** (this PR)` : `${i + 1}. #${pr.number}`
    )
    .join('\n')
}

// GitHub picks the `<source>` that matches the reader's theme.
function renderStatusImage(stackId: string, pr: PullRequest) {
  const src = `${SITE_URL}/stacks/${stackId}/status?pr=${pr.number}`
  return [
    '<picture>',
    `  <source media="(prefers-color-scheme: dark)" srcset="${src}&amp;theme=dark">`,
    `  <img alt="Status of the stack's PRs" src="${src}">`,
    '</picture>'
  ].join('\n')
}

// Hidden from readers, but agents that review or work on the PR read comments in the raw markdown.
// Branch names are used instead of commit hashes, since they stay the same when the stack is rebased.
function renderAgentGuide(stack: PullRequest[], index: number) {
  const pr = stack[index]
  const below = stack.slice(0, index)
  const above = stack.slice(index + 1)
  const parent = below.at(-1)

  const lines = [
    `This PR is ${index + 1} of ${stack.length} in a stack of PRs from the fork \`${pr.headRepo}\`, merged bottom to top.`,
    parent
      ? `Its branch \`${pr.headRef}\` is built on \`${parent.headRef}\` (#${parent.number}), so its diff on GitHub also contains ${refs(below)}. Review only the commits in \`${parent.headRef}..${pr.headRef}\`, or open ${SITE_URL}/review/${pr.id}.`
      : `It is the bottom of the stack, so its diff on GitHub only contains its own changes.`,
    above.length > 0
      ? `The PRs above it (${refs(above)}) build on this PR. Changes that belong there are out of scope here.`
      : `It is the top of the stack.`
  ]

  return ['<!-- forkstack-agent', ...lines, '-->'].join('\n')
}

function refs(prs: PullRequest[]) {
  return prs.map(pr => `#${pr.number}`).join(', ')
}
