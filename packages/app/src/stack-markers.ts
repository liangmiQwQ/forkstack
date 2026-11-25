import type { CommentsByPr, PullRequest } from '@forkstack/core/discovery'
import { MARKER, renderComment } from '@forkstack/core/marker'
import { env } from 'void/env'

import {
  addComment,
  deleteComment,
  fetchViewerComments,
  fetchViewerCommentsById,
  updateComment
} from './github.ts'
import type { Comment } from './github.ts'
import { saveCommentId } from './stack.ts'
import type { StoredPr, StoredStack } from './stack.ts'

// Markers are bot comments, since organizations often block OAuth apps from editing PRs and external contributors can't approve them.
// A PR may carry markers already, such as when its stack was lost with the database, so the newest one is reused and older ones are deleted.
export async function markPrs(prs: PullRequest[], stackId: string): Promise<void> {
  const comments = await fetchViewerCommentsById(
    env.GITHUB_BOT_TOKEN,
    prs.map(pr => pr.id)
  )

  for (const [index, pr] of prs.entries()) {
    const markers = (comments.get(pr.id) ?? []).filter(comment => comment.body.includes(MARKER))
    // GitHub asks clients to send mutations one at a time, or it may apply its secondary rate limit.
    const commentId = await writeMarker(pr.id, markers.at(-1), renderComment(stackId, prs, index))
    await saveCommentId(pr.id, commentId)

    for (const duplicate of markers.slice(0, -1)) {
      await deleteComment(env.GITHUB_BOT_TOKEN, duplicate.id)
    }
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

async function writeMarker(
  prId: string,
  existing: Comment | undefined,
  body: string
): Promise<string> {
  if (!existing) {
    return addComment(env.GITHUB_BOT_TOKEN, prId, body)
  }

  await updateComment(env.GITHUB_BOT_TOKEN, existing.id, body)
  return existing.id
}

// Read with the bot token, so a marker someone else copies into a comment is ignored.
export function fetchBotComments(prs: PullRequest[]): Promise<CommentsByPr> {
  return fetchViewerComments(env.GITHUB_BOT_TOKEN, prs)
}
