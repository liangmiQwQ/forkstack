import { defer, defineHandler, defineHead } from 'void'
import type { InferProps } from 'void'
import { requireAuth } from 'void/auth'

import { getGithubToken } from '../../src/account.ts'
import { findStacks, groupCandidates, isManaged } from '../../src/discovery.ts'
import { searchOpenPrs } from '../../src/github.ts'
import { cacheStacks, readCachedStacks } from '../../src/stack-cache.ts'
import { fetchBotComments } from '../../src/stack-markers.ts'

export type Props = InferProps<typeof loader>

export const loader = defineHandler(async c => {
  const user = requireAuth(c, { throwRedirect: '/login' })

  // Both GitHub requests are deferred so the page renders at once. The search returns commits, so stacks show right after it.
  // The second request reads the bot's comments for forkstack markers, so managed stacks are recognized even if the database is lost.
  const tokenPromise = getGithubToken(c, user.id)
  const stacksPromise = tokenPromise
    .then(searchOpenPrs)
    .then(prs => groupCandidates(prs).flatMap(group => findStacks(group)))

  return {
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

export const head = defineHead(() => ({ title: 'Dashboard' }))
