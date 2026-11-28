import type { PullRequest } from '@forkstack/core/discovery'
import { HTTPException } from 'hono/http-exception'

import { fetchViewerPermission } from './github.ts'

// Only a fork admin can add the push webhook, and only then is the fork the contributor's to rewrite.
export async function requireForkAdmin(token: string, fork: string): Promise<void> {
  if (!(await isForkAdmin(token, fork))) {
    throw new HTTPException(403, {
      message: `forkstack needs admin access to ${fork}, so it can add a push webhook there, and you don't have it. Push the branches to a fork under your own GitHub account, open the pull requests from it, then try again.`
    })
  }
}

// Each fork is checked once, however many stacks it holds.
export async function keepAdminStacks(
  token: string,
  stacks: PullRequest[][]
): Promise<PullRequest[][]> {
  const forks = [...new Set(stacks.flatMap(stack => stack[0].headRepo ?? []))]
  const checks = await Promise.all(forks.map(fork => isForkAdmin(token, fork)))
  const admin = new Set(forks.filter((_, index) => checks[index]))
  return stacks.filter(stack => admin.has(stack[0].headRepo ?? ''))
}

async function isForkAdmin(token: string, fork: string): Promise<boolean> {
  return (await fetchViewerPermission(token, fork)) === 'ADMIN'
}
