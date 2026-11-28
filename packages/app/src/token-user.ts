import { accountTable } from '@auth-schema'
import { request } from '@octokit/request'
import { RequestError } from '@octokit/request-error'
import { HTTPException } from 'hono/http-exception'
import type { CloudContext } from 'void'
import { and, db, eq, isNotNull } from 'void/db'
import { kv } from 'void/kv'

import { sha256 } from './hash.ts'

export interface TokenUser {
  userId: string
  /** The caller's GitHub token, used for this request's GitHub calls and never stored. */
  token: string
}

// Every CLI command checks its token, so a short cache keeps it under GitHub's rate limit.
// 60 seconds is also the shortest TTL Cloudflare KV accepts.
const TTL_SECONDS = 60

// Keyed by a hash of the token, so the token itself never reaches storage.
const githubIdByToken = kv.map<string>('token-github-id')

// The CLI sends the token of the `gh` CLI. A GitHub account is a forkstack account, so the CLI stores no token of its own.
export async function requireTokenUser(c: CloudContext): Promise<TokenUser> {
  const token = c.req.header('authorization')?.match(/^bearer (.+)$/i)?.[1]
  if (!token) {
    throw new HTTPException(401, { message: 'Send a GitHub token as a bearer token.' })
  }

  // A revoked token stays cached for up to a minute, so only reads trust the cache.
  const githubId = await findGithubId(token, c.req.method === 'GET')
  if (githubId === null) {
    throw new HTTPException(401, { message: 'This GitHub token is not valid.' })
  }

  // Users sign in on the web once with `forkstack login`, which grants the OAuth access restacks and push webhooks use.
  // An account without a stored grant was signed out, so `forkstack login` signs in on the web again.
  const account = await db
    .select({ userId: accountTable.userId })
    .from(accountTable)
    .where(
      and(
        eq(accountTable.providerId, 'github'),
        eq(accountTable.accountId, githubId),
        isNotNull(accountTable.accessToken)
      )
    )
    .get()
  if (!account) {
    throw new HTTPException(403, {
      message: 'Sign in to forkstack once with `forkstack login`.'
    })
  }

  return { userId: account.userId, token }
}

// Better Auth stores the GitHub user ID as the account ID, as a string.
async function findGithubId(token: string, useCache: boolean): Promise<string | null> {
  const key = await sha256(token)
  const cached = useCache ? await githubIdByToken.get(key) : null
  if (cached !== null) {
    return cached
  }

  try {
    const { data } = await request('GET /user', { headers: { authorization: `token ${token}` } })
    const githubId = String(data.id)
    await githubIdByToken.put(key, githubId, { ttl: TTL_SECONDS })
    return githubId
  } catch (error) {
    if (error instanceof RequestError && error.status === 401) {
      return null
    }
    throw error
  }
}
