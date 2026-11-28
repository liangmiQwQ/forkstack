import { request } from '@octokit/request'
import { RequestError } from '@octokit/request-error'
import { HTTPException } from 'hono/http-exception'
import { env } from 'void/env'

import { getGithubScopes, readGithubToken } from './account.ts'

// `admin:repo_hook` includes `write:repo_hook`.
const HOOK_SCOPES = new Set(['write:repo_hook', 'admin:repo_hook'])

interface Hook {
  id: number
  active: boolean
  events: string[]
  config: { url?: string; content_type?: string; secret?: string }
}

// The page forkstack sends users to when their GitHub grant is missing the hook scope. It offers to reauthorize.
const REAUTHORIZE_PATH = '/stacks/new'

async function canAddHooks(userId: string): Promise<boolean> {
  const scopes = await getGithubScopes(userId)
  return scopes.some(scope => HOOK_SCOPES.has(scope))
}

// A push to a stack branch clears the stack's cached status, so the hook must exist before the stack is linked.
// The hook is added with the user's OAuth grant, also when the CLI links the stack with the token of `gh`.
export async function requirePushHook(userId: string, fork: string, origin: string): Promise<void> {
  const token = await readGithubToken(userId)
  if (!token || !(await canAddHooks(userId))) {
    throw reauthorizeError(fork, origin)
  }

  try {
    await ensurePushHook(token, fork, `${origin}/webhooks/github`)
  } catch (error) {
    // GitHub answers 404 when the grant lacks the scope, and 401 once it is revoked.
    if (error instanceof RequestError && [401, 403, 404].includes(error.status)) {
      throw reauthorizeError(fork, origin)
    }
    throw new HTTPException(503, {
      message: `GitHub didn't answer while forkstack added a push webhook to ${fork}. Try again in a moment.`
    })
  }
}

async function ensurePushHook(token: string, fork: string, url: string): Promise<void> {
  const hooks = createHooks(token, fork)
  const hook = (await hooks.find(url)) ?? (await hooks.create(url))
  if (!isUsable(hook)) {
    await hooks.repair(hook)
  }
}

function createHooks(token: string, fork: string) {
  const [owner, repo] = fork.split('/')
  const api = request.defaults({ headers: { authorization: `token ${token}` } })
  const target = { owner, repo }

  const hooks = {
    async find(url: string): Promise<Hook | null> {
      const { data } = await api('GET /repos/{owner}/{repo}/hooks', { ...target, per_page: 100 })
      return (data as Hook[]).find(hook => hook.config.url === url) ?? null
    },

    // GitHub refuses a second hook with the same URL, so a concurrent binding that loses the race reuses the winner's hook.
    async create(url: string): Promise<Hook> {
      try {
        const { data } = await api('POST /repos/{owner}/{repo}/hooks', {
          ...target,
          name: 'web',
          active: true,
          events: ['push'],
          config: hookConfig(url)
        })
        return data
      } catch (error) {
        const winner =
          error instanceof RequestError && error.status === 422 && (await hooks.find(url))
        if (!winner) {
          throw error
        }
        return winner
      }
    },

    // A hook that points here but was disabled or changed on GitHub is fixed instead of duplicated.
    async repair(hook: Hook): Promise<void> {
      await api('PATCH /repos/{owner}/{repo}/hooks/{hook_id}', {
        ...target,
        hook_id: hook.id,
        active: true,
        events: [...new Set([...hook.events, 'push'])],
        config: hookConfig(hook.config.url ?? '')
      })
    }
  }
  return hooks
}

// GitHub hides the secret behind asterisks, so a hook with one is taken to have this deployment's.
function isUsable(hook: Hook) {
  return (
    hook.active &&
    (hook.events.includes('push') || hook.events.includes('*')) &&
    hook.config.content_type === 'json' &&
    Boolean(hook.config.secret)
  )
}

function hookConfig(url: string) {
  return { url, content_type: 'json', secret: env.GITHUB_WEBHOOK_SECRET, insecure_ssl: '0' }
}

function reauthorizeError(fork: string, origin: string) {
  return new HTTPException(403, {
    message: `forkstack needs your permission to add a push webhook to ${fork}. Reauthorize forkstack with GitHub at ${origin}${REAUTHORIZE_PATH}, then try again.`
  })
}
