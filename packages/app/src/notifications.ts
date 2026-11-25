import { request } from '@octokit/request'
import { RequestError } from '@octokit/request-error'
import { env } from 'void/env'
import { kv } from 'void/kv'

import { restackIfMerged } from './restack-job.ts'
import { syncMarkers } from './stack-markers.ts'
import { clearStackPrs, fetchStackPrs } from './stack-status.ts'
import { findStackId } from './stack.ts'

interface Thread {
  id: string
  subject: { type: string; url: string }
}

// GitHub's largest page. A full page may have more behind it, so the next poll reads again instead of waiting for a change.
const PAGE_SIZE = 50

const pollState = kv.map<string>('notifications')

// Forkstack hears nothing from upstream repositories, but the bot comments on every stack PR, so GitHub subscribes it to them.
// A merge then shows up in the bot's notifications, which are polled since GitHub has no webhook for them.
export async function pollNotifications(): Promise<void> {
  // 1. Read the unread threads. A 304 means nothing changed and doesn't count against the rate limit.
  const api = request.defaults({ headers: { authorization: `token ${env.GITHUB_BOT_TOKEN}` } })
  const since = await pollState.get('last-modified')
  const page = await fetchThreads(api, since)
  if (!page) {
    return
  }

  // 2. Check every stack a PR thread belongs to. A notification can be any activity, so the check reads the PRs itself.
  for (const thread of page.threads) {
    if (thread.subject.type === 'PullRequest') {
      await checkPr(api, thread.subject.url)
    }
    // Marked read only once handled, so a failed poll sees the thread again.
    await api('PATCH /notifications/threads/{thread_id}', { thread_id: Number(thread.id) })
  }

  // 3. Remember where this poll ended
  if (page.lastModified && page.threads.length < PAGE_SIZE) {
    await pollState.put('last-modified', page.lastModified)
  }
}

async function fetchThreads(api: typeof request, since: string | null) {
  try {
    const response = await api('GET /notifications', {
      per_page: PAGE_SIZE,
      headers: since ? { 'if-modified-since': since } : {}
    })
    return { threads: response.data as Thread[], lastModified: response.headers['last-modified'] }
  } catch (error) {
    if (error instanceof RequestError && error.status === 304) {
      return null
    }
    throw error
  }
}

// The thread links the PR's REST URL, while stacks store GraphQL node IDs.
async function checkPr(api: typeof request, url: string) {
  const { data } = await api<{ node_id: string }>({ method: 'GET', url })
  const stackId = await findStackId(data.node_id)
  if (!stackId) {
    return
  }

  // The cached PRs may be from before the merge.
  await clearStackPrs(stackId)
  const prs = await fetchStackPrs(stackId)
  if (prs) {
    await restackIfMerged(stackId, prs)
    await syncMarkers(stackId, prs)
  }
}
