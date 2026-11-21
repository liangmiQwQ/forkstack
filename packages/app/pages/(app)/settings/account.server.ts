import { HTTPException } from 'hono/http-exception'
import { defineHandler, defineHead } from 'void'
import type { InferProps } from 'void'
import { getAuth, requireAuth } from 'void/auth'

import { getGithubScopes } from '../../../src/account.ts'
import { toProfile } from '../../../src/user.ts'

export type Props = InferProps<typeof loader>

export const loader = defineHandler(async c => {
  const user = requireAuth(c, { throwRedirect: '/login' })
  return { profile: toProfile(user), scopes: await getGithubScopes(user.id) }
})

export const actions = {
  signOut: defineHandler(async c => {
    await getAuth(c).api.signOut({ headers: c.req.raw.headers })
    return c.redirect('/login')
  }),

  deleteAccount: defineHandler(async c => {
    try {
      await getAuth(c).api.deleteUser({ body: {}, headers: c.req.raw.headers })
    } catch {
      // The usual cause: Better Auth only deletes accounts from a session created within the last day.
      throw new HTTPException(400, {
        message: 'Could not delete your account. Sign out, sign in again, and retry.'
      })
    }
    return c.redirect('/login')
  })
}

export const head = defineHead(() => ({ title: 'Account settings' }))
