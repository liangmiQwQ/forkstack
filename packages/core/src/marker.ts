import type { PullRequest } from './discovery.ts'

// Every PR managed by forkstack carries a bot comment with this HTML comment, so stacks can be found from GitHub alone.
export const MARKER = '<!-- forkstack'

const SITE_URL = 'https://forkstack.dev'
const STACK_DOCS_URL = `${SITE_URL}/docs`

// The comment is only rewritten when the stack's PRs change, so it only holds facts forkstack controls.
// Live stack status and the rebase controls are on the stack page the "View stack" button links to.
// Once every PR merged, forkstack deletes the stack after a while but leaves the comments, so they drop every link to forkstack's pages.
export function renderComment(stackId: string, stack: PullRequest[], index: number): string {
  const pr = stack[index]
  const merged = stack.every(pr => pr.state === 'MERGED')

  const body = [
    `This PR is in a stack (${index + 1} of ${stack.length}). Learn more about [stacked PRs created with forkstack](${STACK_DOCS_URL}).`,
    renderList(stack, index),
    ...(merged
      ? ['Every PR in this stack has merged.']
      : [
          `${renderReviewButton(pr.id)} ${renderStackButton(stackId)}`,
          "The stack's author can rebase it from the stack page."
        ])
  ].join('\n\n')

  const warning = `> [!WARNING]\n> ${body.replaceAll('\n', '\n> ')}`
  // Agents have nothing left to review or change once the stack merged.
  const guide = merged ? [] : [renderAgentGuide(stack, index)]
  return [`${MARKER}:stack=${stackId} -->`, warning, ...guide].join('\n\n')
}

// Drawn like a stack, with the top PR first and the base branch at the bottom.
// GitHub renders a `#123` list item with the PR's title and state, so the list needs no live status of its own.
function renderList(stack: PullRequest[], index: number) {
  const prs = stack.map((pr, i) => (i === index ? `- #${pr.number} (this PR)` : `- #${pr.number}`))
  return [...prs.toReversed(), `- \`${stack[0].baseRef}\``].join('\n')
}

// Anyone can view the stack, while only its owner sees the rebase controls there.
function renderStackButton(stackId: string) {
  return renderButton(
    `${SITE_URL}/stacks/${stackId}`,
    `${SITE_URL}/buttons/stack`,
    'View the stack'
  )
}

function renderReviewButton(prId: string) {
  return renderButton(
    `${SITE_URL}/review/${prId}`,
    `${SITE_URL}/buttons/review`,
    "Review only this PR's changes"
  )
}

// GitHub picks the `<source>` that matches the reader's theme, and the alt text keeps the link usable if the image fails to load.
// Kept on one line: a line break inside `<a>` renders as an underlined gap, and a tag alone on its line starts a raw HTML block without paragraph spacing.
function renderButton(href: string, src: string, alt: string) {
  return [
    `<a href="${href}">`,
    '<picture>',
    `<source media="(prefers-color-scheme: dark)" srcset="${src}?theme=dark">`,
    `<img src="${src}" alt="${alt}">`,
    '</picture>',
    '</a>'
  ].join('')
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
