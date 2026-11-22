import type { PullRequest } from './discovery.ts'

// Every PR managed by forkstack carries a bot comment with this HTML comment, so stacks can be found from GitHub alone.
export const MARKER = '<!-- forkstack'

const SITE_URL = 'https://forkstack.dev'

// The comment is only rewritten when the stack's PRs change, so it only holds facts forkstack controls.
// Live PR status comes from an image forkstack draws on each view, since there are no webhooks to tell when it changes.
export function renderComment(stackId: string, stack: PullRequest[], index: number): string {
  const pr = stack[index]

  return [
    `${MARKER}:stack=${stackId} -->`,
    renderList(stack, index),
    `[Review only this PR's changes](${SITE_URL}/review/${pr.id})`,
    renderStatusImage(stackId, pr),
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
    `  <img src="${src}">`,
    '</picture>'
  ].join('\n')
}

// Hidden from readers, but agents that review or work on the PR read comments in the raw markdown.
// Branch names are used instead of commit hashes, since they stay the same when the stack is rebased.
function renderAgentGuide(stack: PullRequest[], index: number) {
  const pr = stack[index]

  return [
    '<!-- forkstack-agent',
    `Note for AI agents: this PR is ${index + 1} of ${stack.length} in a stack of PRs from the fork \`${pr.headRepo}\`, merged bottom to top.`,
    '',
    'If you are reviewing this PR:',
    ...reviewSteps(stack, index),
    '',
    'If you are changing this PR:',
    ...changeSteps(stack),
    '-->'
  ].join('\n')
}

function reviewSteps(stack: PullRequest[], index: number) {
  const pr = stack[index]
  const below = stack.slice(0, index)
  const above = stack.slice(index + 1)
  const parent = below.at(-1)

  return [
    parent
      ? `- GitHub's diff also contains ${refs(below)}. Review only the commits in \`${parent.headRef}..${pr.headRef}\`, or the diff at ${SITE_URL}/review/${pr.id}.`
      : `- This is the bottom of the stack, so GitHub's diff only contains this PR's changes.`,
    ...(below.length > 0 ? [`- Don't ask for changes that belong to ${refs(below)}.`] : []),
    ...(above.length > 0
      ? [
          `- The PRs above it (${refs(above)}) build on this PR. Don't ask for changes that belong there.`
        ]
      : [])
  ]
}

// Agents tend to commit everything to the PR they were asked about, so they are pointed at every layer's branch.
function changeSteps(stack: PullRequest[]) {
  const layers = stack.map(pr => `#${pr.number} \`${pr.headRef}\``).join(', ')
  return [
    `- Find which PR in the stack each change belongs to, and commit it to that PR's branch: ${layers}.`
  ]
}

function refs(prs: PullRequest[]) {
  return prs.map(pr => `#${pr.number}`).join(', ')
}
