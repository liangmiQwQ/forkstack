import { HTTPException } from 'hono/http-exception'
import * as v from 'valibot'
import { defer, defineHandler, defineHead } from 'void'
import type { InferProps } from 'void'
import { requireAuth } from 'void/auth'

import { getGithubToken } from '../../src/account.ts'
import { fetchPrs } from '../../src/github.ts'
import { cacheSavedPrs, readCachedSavedPrs } from '../../src/stack-cache.ts'
import { refreshMarkers, unmarkPrs } from '../../src/stack-markers.ts'
import { deleteStack, listStacks, removePr } from '../../src/stack.ts'

export type Props = InferProps<typeof loader>

export const loader = defineHandler(async c => {
  const user = requireAuth(c, { throwRedirect: '/login' })
  const tokenPromise = getGithubToken(c, user.id)
  const [saved, cachedPrs] = await Promise.all([listStacks(user.id), readCachedSavedPrs(user.id)])

  return {
    // The page builds its stacks from these database rows, so they are right on the first render and right after each action.
    saved: saved.map(stack => ({ id: stack.id, prIds: stack.prs.map(pr => pr.id) })),
    // PRs from the last visit fill the first screen while GitHub answers.
    cachedPrs,
    prs: defer(async () => {
      const prs = await fetchPrs(
        await tokenPromise,
        saved.flatMap(stack => stack.prs.map(pr => pr.id))
      )
      await cacheSavedPrs(user.id, prs)
      return prs
    })
  }
})

// Each action saves to the database first, since it is the source of truth, then updates the markers on GitHub.
export const actions = {
  deleteStack: defineHandler.withValidator({
    body: v.object({ stackId: v.string() })
  })(async (c, { body }) => {
    const user = requireAuth(c)
    const stack = (await listStacks(user.id)).find(stack => stack.id === body.stackId)
    if (!stack) {
      throw new HTTPException(404, { message: 'This stack no longer exists.' })
    }

    await deleteStack(stack.id)
    await unmarkPrs(stack.prs)
  }),

  removePr: defineHandler.withValidator({
    body: v.object({ prId: v.string() })
  })(async (c, { body }) => {
    const user = requireAuth(c)
    const stack = (await listStacks(user.id)).find(stack =>
      stack.prs.some(pr => pr.id === body.prId)
    )
    const pr = stack?.prs.find(pr => pr.id === body.prId)
    if (!stack || !pr) {
      throw new HTTPException(404, { message: 'This PR is not in a stack anymore.' })
    }
    if (stack.prs.length <= 2) {
      throw new HTTPException(400, { message: 'A stack needs two PRs. Unlink the stack instead.' })
    }

    await removePr(pr.id)
    await unmarkPrs([pr])

    const rest = { ...stack, prs: stack.prs.filter(other => other !== pr) }
    const prs = await fetchPrs(
      await getGithubToken(c, user.id),
      rest.prs.map(other => other.id)
    )
    await refreshMarkers(rest, prs)
  })
}

export const head = defineHead(() => ({ title: 'Dashboard' }))
