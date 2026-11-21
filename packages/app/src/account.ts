import { accountTable } from '@auth-schema'
import { and, db, eq } from 'void/db'

export async function getGithubScopes(userId: string): Promise<string[]> {
  const account = await db
    .select({ scope: accountTable.scope })
    .from(accountTable)
    .where(and(eq(accountTable.userId, userId), eq(accountTable.providerId, 'github')))
    .get()

  // Better Auth stores granted scopes as a comma-separated string.
  return account?.scope?.split(',').filter(Boolean) ?? []
}
