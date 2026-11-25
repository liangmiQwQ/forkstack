import type { PullRequest } from '@forkstack/core/discovery'
import { countMerged } from '@forkstack/core/stack-health'

import type { RestackStatus } from './restack-job.ts'

export interface StackNotice {
  /** `problem` asks the user to step in, `running` only says forkstack is at work. */
  kind: 'idle' | 'running' | 'problem'
  label: string
}

// Restacks after a merge run without anyone watching the restack page, so the rebase button under each PR tells the user what needs them.
// A button has room for a few words, so the restack page it links to explains each problem.
export function describeStack(prs: PullRequest[], status: RestackStatus | null): StackNotice {
  if (countMerged(prs.map(pr => pr.state)) === null) {
    return problem('Stack broken, rebase by hand')
  }

  const number = (prId: string) => prs.find(pr => pr.id === prId)?.number

  switch (status?.state) {
    case undefined:
    case 'done': {
      return { kind: 'idle', label: 'Rebase the stack' }
    }
    case 'running': {
      return { kind: 'running', label: 'Rebasing the stack…' }
    }
    case 'conflict': {
      return problem(`#${number(status.prId)} conflicts`)
    }
    case 'ambiguous': {
      return problem(`Can't find #${number(status.prId)}'s commits`)
    }
    default: {
      return problem('Last rebase failed')
    }
  }
}

function problem(label: string): StackNotice {
  return { kind: 'problem', label }
}
