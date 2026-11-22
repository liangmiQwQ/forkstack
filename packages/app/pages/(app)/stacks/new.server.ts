import { HTTPException } from 'hono/http-exception'
import * as v from 'valibot'
import { defer, defineHandler, defineHead } from 'void'
import type { InferProps } from 'void'
import { requireAuth } from 'void/auth'

import { getGithubToken } from '../../../src/account.ts'
import { discoverStacks, isManaged } from '../../../src/discovery.ts'
import type { PullRequest } from '../../../src/discovery.ts'
import { searchOpenPrs } from '../../../src/github.ts'
import { addCachedSavedPrs, cacheStacks, readCachedStacks } from '../../../src/stack-cache.ts'
import { fetchBotComments, markPrs } from '../../../src/stack-markers.ts'
import { createStack, listStacks } from '../../../src/stack.ts'
import type { StoredStack } from '../../../src/stack.ts'

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

  const [saved, cachedStacks] = await Promise.all([savedPromise, readCachedStacks(user.id)])

  return {
    // Stacks from the last visit fill the first screen while GitHub answers.
    cachedStacks: cachedStacks && excludeSaved(cachedStacks, saved),
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

    // The database is saved first, since it is the source of truth, then the markers go on GitHub.
    const id = await createStack(user.id, body.prIds)
    await markPrs(stack, id)
    // The dashboard renders the new stack from the cache before GitHub answers.
    await addCachedSavedPrs(user.id, stack)
    return c.redirect('/dashboard')
  })
}

export const head = defineHead(() => ({ title: 'Find stacks' }))

// A PR can only be in one stack, so possible stacks that share a PR with a saved stack are left out.
function excludeSaved(stacks: PullRequest[][], saved: StoredStack[]) {
  const savedIds = new Set(saved.flatMap(stack => stack.prs.map(pr => pr.id)))
  return stacks.filter(stack => !stack.some(pr => savedIds.has(pr.id)))
}
