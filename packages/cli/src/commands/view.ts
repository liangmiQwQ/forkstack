import type { PullRequest } from '@forkstack/core/discovery'
import { findReviewUrl } from '@forkstack/core/review'
import { define } from 'gunshi'
import c from 'picocolors'

import { findBranchStack } from '../current-stack.ts'
import { currentBranch } from '../git.ts'
import { findRemotes, REMOTE_ARGS } from '../remotes.ts'

export const view = define({
  name: 'view',
  description: 'Show the stack of the current branch, bottom to top',
  args: REMOTE_ARGS,
  run: async ctx => {
    const remotes = await findRemotes(ctx.values)
    const branch = await currentBranch()
    const stack = await findBranchStack(remotes, branch)

    console.log(`Stack in ${remotes.upstream}, bottom to top:\n`)
    for (const [index, pr] of stack.prs.entries()) {
      const marker = pr.headRef === branch ? c.cyan('▸') : ' '
      console.log(
        `${marker} ${index + 1}. ${c.bold(`#${pr.number}`)} ${pr.title}  ${renderStatus(pr)}`
      )
      // GitHub's own diff of an upper PR holds every PR below it, so the link shows only this PR's changes.
      console.log(`     ${c.dim(findReviewUrl(stack.prs, pr.id) ?? pr.url)}`)
    }
  }
})

function renderStatus(pr: PullRequest) {
  return [renderState(pr), renderChecks(pr.checks), renderReview(pr.reviewDecision)]
    .filter(part => part !== null)
    .join(c.dim(' · '))
}

function renderState(pr: PullRequest) {
  switch (pr.state) {
    case 'MERGED': {
      return c.magenta('merged')
    }
    case 'CLOSED': {
      return c.red('closed')
    }
    default: {
      return pr.isDraft ? c.dim('draft') : c.green('open')
    }
  }
}

function renderChecks(checks: PullRequest['checks']) {
  switch (checks) {
    case 'passing': {
      return c.green('checks passing')
    }
    case 'failing': {
      return c.red('checks failing')
    }
    case 'running': {
      return c.yellow('checks running')
    }
    default: {
      return null
    }
  }
}

function renderReview(decision: PullRequest['reviewDecision']) {
  switch (decision) {
    case 'APPROVED': {
      return c.green('approved')
    }
    case 'CHANGES_REQUESTED': {
      return c.red('changes requested')
    }
    case 'REVIEW_REQUIRED': {
      return c.yellow('review required')
    }
    default: {
      return null
    }
  }
}
