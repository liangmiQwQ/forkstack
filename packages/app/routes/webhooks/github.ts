import { verify } from '@octokit/webhooks-methods'
import * as v from 'valibot'
import { defineHandler } from 'void'
import { env } from 'void/env'

import { findPrIdsByHead } from '../../src/github.ts'
import { clearStackStatus } from '../../src/stack-status.ts'
import { findStackId } from '../../src/stack.ts'

const PUSH_EVENT = v.object({
  ref: v.string(),
  repository: v.object({ full_name: v.string() })
})

// Linking a stack adds a push webhook to its fork, so forkstack hears pushes to stack branches but nothing from upstream.
export const POST = defineHandler(async c => {
  // The signature covers the exact bytes GitHub sent, so the body is read as text before parsing.
  const body = await c.req.text()
  const signature = c.req.header('x-hub-signature-256') ?? ''
  if (!(await verify(env.GITHUB_WEBHOOK_SECRET, body, signature))) {
    return c.body(null, 401)
  }

  if (c.req.header('x-github-event') === 'push') {
    await handlePush(v.parse(PUSH_EVENT, JSON.parse(body)))
  }
  return c.body(null, 204)
})

// A push changes the PR's commits, so cached status for its stack is dropped and the next view reads GitHub again.
async function handlePush(event: v.InferOutput<typeof PUSH_EVENT>) {
  const prIds = await findPrIdsByHead(env.GITHUB_BOT_TOKEN, event.repository.full_name, event.ref)
  const stackIds = await Promise.all(prIds.map(findStackId))

  for (const stackId of new Set(stackIds)) {
    if (stackId) {
      await clearStackStatus(stackId)
    }
  }
}
