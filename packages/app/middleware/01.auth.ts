import { defineMiddleware } from 'void'
import { getUser } from 'void/auth'

import { toProfile } from '../src/user.ts'
import type { Profile } from '../src/user.ts'

declare module 'void' {
  interface CloudContextVariables {
    shared: { profile: Profile | null }
  }
}

export default defineMiddleware(async (c, next) => {
  const user = getUser()
  c.set('shared', { profile: user ? toProfile(user) : null })
  await next()
})
