import { HTTPException } from 'hono/http-exception'
import * as v from 'valibot'
import { defer, defineHandler, defineHead } from 'void'
import type { InferProps } from 'void'
import { requireAuth } from 'void/auth'

import { getGithubToken } from '../../src/account.ts'
import { discoverStacks, isManaged } from '../../src/discovery.ts'
import type { PullRequest } from '../../src/discovery.ts'
import { fetchPrs, searchOpenPrs } from '../../src/github.ts'
import { cacheStacks, readCachedStacks } from '../../src/stack-cache.ts'
import { fetchBotComments, markPrs, unmarkPrs } from '../../src/stack-markers.ts'
import { createStack, deleteStack, listStacks, removePr } from '../../src/stack.ts'
import type { StoredStack } from '../../src/stack.ts'

export type Props = InferProps<typeof loader>

const PR_IDS = v.pipe(v.array(v.string()), v.minLength(2))

export const loader = defineHandler(async c => {
  const user = requireAuth(c, { throwRedirect: '/login' })

  // Both GitHub requests are deferred so the page renders at once. The search returns commits, so stacks show right after it.
  // The second request reads the bot's comments for forkstack markers, so managed stacks are recognized even if the database is lost.
  const tokenPromise = getGithubToken(c, user.id)
  const savedPromise = listStacks(user.id)
  const stacksPromise = Promise.all([tokenPromise.then(searchOpenPrs), savedPromise]).then(
    ([prs, saved]) => excludeSaved(discoverStacks(prs), saved)
  )

  return {
    // Sizes of the saved stacks, read from the database so their skeletons match before GitHub answers.
    savedSizes: (await savedPromise).map(stack => stack.prs.length),
    savedStacks: defer(async () => {
      const [token, saved] = await Promise.all([tokenPromise, savedPromise])
      const prs = await fetchPrs(
        token,
        saved.flatMap(stack => stack.prs.map(pr => pr.id))
      )
      return saved.map(stack => ({
        id: stack.id,
        prs: pickPrs(
          prs,
          stack.prs.map(pr => pr.id)
        )
      }))
    }),
    // Stacks from the last visit fill the first screen while GitHub answers.
    cachedStacks: await readCachedStacks(user.id),
    stacks: defer(async () => {
      const stacks = await stacksPromise
      await cacheStacks(user.id, stacks)
      return stacks
    }),
    // Aligned with `stacks`: entry `i` tells whether stack `i` is already managed by forkstack.
    managed: defer(async () => {
      const stacks = await stacksPromise
      const comments = await fetchBotComments(stacks.flat())
      return stacks.map(stack => isManaged(stack, comments))
    })
  }
})

// Each action saves to the database first, since it is the source of truth, then updates the markers on GitHub.
export const actions = {
  createStack: defineHandler.withValidator({
    body: v.object({ prIds: PR_IDS })
  })(async (c, { body }) => {
    const user = requireAuth(c)
    const token = await getGithubToken(c, user.id)

    // The stack is found again from GitHub, so only the user's own PRs are saved, in the order their commits show.
    const [prs, saved] = await Promise.all([searchOpenPrs(token), listStacks(user.id)])
    const stack = excludeSaved(discoverStacks(prs), saved).find(
      stack => stack.map(pr => pr.id).join(',') === body.prIds.join(',')
    )
    if (!stack) {
      throw new HTTPException(409, { message: 'This stack changed on GitHub. Reload and retry.' })
    }

    const id = await createStack(user.id, body.prIds)
    await markPrs(stack, id)
  }),

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
      throw new HTTPException(400, { message: 'A stack needs two PRs. Delete the stack instead.' })
    }

    await removePr(pr.id)
    await unmarkPrs([pr])
  })
}

export const head = defineHead(() => ({ title: 'Dashboard' }))

// A PR can only be in one stack, so possible stacks that share a PR with a saved stack are left out.
function excludeSaved(stacks: PullRequest[][], saved: StoredStack[]) {
  const savedIds = new Set(saved.flatMap(stack => stack.prs.map(pr => pr.id)))
  return stacks.filter(stack => !stack.some(pr => savedIds.has(pr.id)))
}

// Keeps the saved order and skips PRs that were deleted on GitHub.
function pickPrs(prs: PullRequest[], ids: string[]) {
  const prsById = new Map(prs.map(pr => [pr.id, pr]))
  return ids.map(id => prsById.get(id)).filter(pr => pr !== undefined)
}
