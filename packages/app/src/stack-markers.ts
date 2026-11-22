import { env } from 'void/env'

import type { CommentsByPr, PullRequest } from './discovery.ts'
import { addComment, deleteComment, fetchViewerComments, updateComment } from './github.ts'
import { renderComment } from './marker.ts'
import { saveCommentId } from './stack.ts'
import type { StoredPr, StoredStack } from './stack.ts'

// Markers are bot comments, since organizations often block OAuth apps from editing PRs and external contributors can't approve them.
export async function markPrs(prs: PullRequest[], stackId: string): Promise<void> {
  for (const [index, pr] of prs.entries()) {
    // GitHub asks clients to send mutations one at a time, or it may apply its secondary rate limit.
    const commentId = await addComment(
      env.GITHUB_BOT_TOKEN,
      pr.id,
      renderComment(stackId, prs, index)
    )
    await saveCommentId(pr.id, commentId)
  }
}

// Rewrites the comments after the stack's PRs change, since each one lists the whole stack.
export async function refreshMarkers(stack: StoredStack, prs: PullRequest[]): Promise<void> {
  const commentIds = new Map(stack.prs.map(pr => [pr.id, pr.commentId]))

  for (const [index, pr] of prs.entries()) {
    const commentId = commentIds.get(pr.id)
    if (commentId) {
      await updateComment(env.GITHUB_BOT_TOKEN, commentId, renderComment(stack.id, prs, index))
    }
  }
}

export async function unmarkPrs(prs: StoredPr[]): Promise<void> {
  for (const pr of prs) {
    if (pr.commentId) {
      await deleteComment(env.GITHUB_BOT_TOKEN, pr.commentId)
    }
  }
}

// Read with the bot token, so a marker someone else copies into a comment is ignored.
export function fetchBotComments(prs: PullRequest[]): Promise<CommentsByPr> {
  return fetchViewerComments(env.GITHUB_BOT_TOKEN, prs)
}
