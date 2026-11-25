import type { PullRequest } from '@forkstack/core/discovery'
import { countMerged } from '@forkstack/core/stack-health'

import type { RestackStatus } from './restack-job.ts'

export interface StackNotice {
  /** `problem` asks the user to step in, `running` only says forkstack is at work. */
  kind: 'running' | 'problem'
  text: string
}

// Restacks after a merge run without anyone watching the restack page, so the status image under each PR tells the user what needs them.
// The image has room for one short line, so failures that only the restack page can explain point there.
export function describeStack(
  prs: PullRequest[],
  status: RestackStatus | null
): StackNotice | null {
  if (countMerged(prs.map(pr => pr.state)) === null) {
    return problem(
      'Stack broken: a PR was closed or merged out of order. Rebase by hand, then recreate it.'
    )
  }

  const number = (prId: string) => prs.find(pr => pr.id === prId)?.number

  switch (status?.state) {
    case undefined:
    case 'done': {
      return null
    }
    case 'running': {
      return { kind: 'running', text: 'Rebasing the stack…' }
    }
    case 'conflict': {
      return problem(`#${number(status.prId)} conflicts. Rebase it by hand, then rebase the stack.`)
    }
    case 'ambiguous': {
      return problem(
        `Can't find #${number(status.prId)}'s own commits. Rebase it by hand, then rebase the stack.`
      )
    }
    default: {
      return problem('The last rebase failed. Open "Rebase the stack" to see why.')
    }
  }
}

function problem(text: string): StackNotice {
  return { kind: 'problem', text }
}
