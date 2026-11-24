import { discoverStacks, isManaged } from '@forkstack/core/discovery'
import { HTTPException } from 'hono/http-exception'
import * as v from 'valibot'
import { defer, defineHandler, defineHead } from 'void'
import type { InferProps } from 'void'
import { requireAuth } from 'void/auth'

import { getGithubToken } from '../../../src/account.ts'
import { searchOpenPrs } from '../../../src/github.ts'
import { cacheStacks, readCachedStacks } from '../../../src/stack-cache.ts'
import { excludeSaved, linkStack } from '../../../src/stack-link.ts'
import { fetchBotComments } from '../../../src/stack-markers.ts'
import { listStacks } from '../../../src/stack.ts'

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
    const id = await linkStack(user.id, await getGithubToken(c, user.id), body.prIds)
    if (!id) {
      throw new HTTPException(409, { message: 'This stack changed on GitHub. Reload and retry.' })
    }

    return c.redirect('/dashboard')
  })
}

export const head = defineHead(() => ({ title: 'Find stacks' }))
