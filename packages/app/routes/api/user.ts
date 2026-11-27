import { userTable } from '@auth-schema'
import { defineHandler } from 'void'
import { db, eq } from 'void/db'

import { requireTokenUser } from '../../src/token-user.ts'

// `forkstack login` asks this until the caller has signed in on the web.
export const GET = defineHandler(async c => {
  const { userId } = await requireTokenUser(c)
  const user = await db
    .select({ name: userTable.name, login: userTable.login })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .get()
  return { name: user!.name, login: user!.login }
})
