import type { PullRequest } from '@forkstack/core/discovery'

import { unlinkStack } from './stack-link.ts'
import { archiveStack, listArchivedBefore } from './stack.ts'
import type { StoredStack } from './stack.ts'

// Long enough for reviewers to look back at what merged, short enough that finished stacks don't pile up.
const ARCHIVE_MS = 30 * 24 * 60 * 60 * 1000

// Returns `null` while the stack is active.
export function deletionDate(stack: StoredStack): string | null {
  return stack.archivedAt && new Date(stack.archivedAt.getTime() + ARCHIVE_MS).toISOString()
}

// Called wherever forkstack reads a stack's PRs. A merged PR only changes its state, so the stack keeps every member until all have merged.
export async function archiveIfMerged(stackId: string, prs: PullRequest[]): Promise<void> {
  if (prs.length > 0 && prs.every(pr => pr.state === 'MERGED')) {
    await archiveStack(stackId)
  }
}

// Only forkstack's record goes. The PRs, their merge history and the bot comments stay on GitHub.
export async function deleteExpiredStacks(): Promise<void> {
  const expired = await listArchivedBefore(new Date(Date.now() - ARCHIVE_MS))
  for (const stack of expired) {
    await unlinkStack(stack)
  }
}
