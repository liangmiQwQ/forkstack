import { accountTable } from '@auth-schema'
import { symmetricDecrypt } from 'better-auth/crypto'
import { HTTPException } from 'hono/http-exception'
import type { CloudContext } from 'void'
import { getAuth } from 'void/auth'
import { and, db, eq } from 'void/db'
import { env } from 'void/env'

// The secret Void gives Better Auth in development, when BETTER_AUTH_SECRET is unset.
const DEV_AUTH_SECRET = 'void-dev-better-auth-secret-1234567890'

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

// Queued restacks run without a browser session, so they can't use Better Auth's API and decrypt the stored token themselves.
// GitHub OAuth App tokens don't expire, so there is nothing to refresh. `null` when the user has no GitHub sign-in.
export async function readGithubToken(userId: string): Promise<string | null> {
  const account = await db
    .select({ accessToken: accountTable.accessToken })
    .from(accountTable)
    .where(and(eq(accountTable.userId, userId), eq(accountTable.providerId, 'github')))
    .get()
  if (!account?.accessToken) {
    return null
  }

  const key = env.BETTER_AUTH_SECRET ?? (import.meta.env.DEV ? DEV_AUTH_SECRET : null)
  if (!key) {
    throw new Error('BETTER_AUTH_SECRET is missing.')
  }
  return symmetricDecrypt({ key, data: account.accessToken })
}

function findGithubAccount(userId: string) {
  return db
    .select({ id: accountTable.id, accountId: accountTable.accountId, scope: accountTable.scope })
    .from(accountTable)
    .where(and(eq(accountTable.userId, userId), eq(accountTable.providerId, 'github')))
    .get()
}
