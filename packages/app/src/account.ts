import { accountTable } from '@auth-schema'
import { HTTPException } from 'hono/http-exception'
import type { CloudContext } from 'void'
import { getAuth } from 'void/auth'
import { and, db, eq } from 'void/db'

export async function getGithubScopes(userId: string): Promise<string[]> {
  const account = await findGithubAccount(userId)

  // Better Auth stores granted scopes as a comma-separated string.
  return account?.scope?.split(',').filter(Boolean) ?? []
}

// Better Auth stores the GitHub user ID as the account ID, as a string.
export async function getGithubId(userId: string): Promise<string | null> {
  return (await findGithubAccount(userId))?.accountId ?? null
}

// Better Auth stores the token encrypted, so read it through its API instead of the account table.
export async function getGithubToken(c: CloudContext, userId: string): Promise<string> {
  const account = await findGithubAccount(userId)
  if (!account) {
    throw new HTTPException(401, { message: 'Sign in with GitHub to continue.' })
  }

  const { accessToken } = await getAuth(c).api.getAccessToken({
    body: { accountId: account.id, userId },
    headers: c.req.raw.headers
  })
  return accessToken
}

function findGithubAccount(userId: string) {
  return db
    .select({ id: accountTable.id, accountId: accountTable.accountId, scope: accountTable.scope })
    .from(accountTable)
    .where(and(eq(accountTable.userId, userId), eq(accountTable.providerId, 'github')))
    .get()
}
