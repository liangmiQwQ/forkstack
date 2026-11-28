import type { PullRequest } from '@forkstack/core/discovery'

import { RESTACK_TIMEOUT_MS } from './restack-status.ts'
import type { RestackStatus } from './restack-status.ts'
import type { RebaseOptions } from './restack.ts'

export interface StackNotice {
  /** `problem` asks the user to step in, `running` only says forkstack is at work. */
  kind: 'idle' | 'current' | 'running' | 'problem'
  label: string
}

// Restacks after a merge run without anyone watching the restack page, so the stack page tells everyone what state the stack is in.
// A button has room for a few words, so the restack page it links to explains each problem.
// The live refs come first, since the last rebase's result is stale once the stack is up to date or can't be rebased.
export function describeStack(
  prs: PullRequest[],
  options: RebaseOptions,
  status: RestackStatus | null
): StackNotice {
  if (options.problem) {
    return problem('Check stack')
  }
  if (!options.onMain) {
    return { kind: 'current', label: 'Up to date' }
  }

  const number = (prId: string) => prs.find(pr => pr.id === prId)?.number

  switch (status?.state) {
    case undefined:
    case 'done': {
      return { kind: 'idle', label: 'Rebase the stack' }
    }
    case 'running': {
      return Date.parse(status.at) + RESTACK_TIMEOUT_MS > Date.now()
        ? { kind: 'running', label: 'Rebasing the stack…' }
        : { kind: 'idle', label: 'Rebase the stack' }
    }
    case 'conflict': {
      return problem(`#${number(status.prId)} conflicts`)
    }
    case 'ambiguous': {
      return problem(`Can't find #${number(status.prId)}'s commits`)
    }
    case 'diverged': {
      return problem(`#${number(status.prId)} needs a local rebase`)
    }
    case 'needs-signature': {
      return problem('Needs a signing key')
    }
    case 'unverified': {
      return problem('Signature not verified')
    }
    default: {
      return problem('Last rebase failed')
    }
  }
}

function problem(label: string): StackNotice {
  return { kind: 'problem', label }
}
