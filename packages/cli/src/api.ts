import type { PullRequest } from '@forkstack/core/discovery'

import { ghToken } from './gh.ts'

export interface StackSummary {
  id: string
  /** GitHub node IDs of the stack's PRs, bottom to top. */
  prIds: string[]
}

export interface Stack {
  id: string
  /** The stack's PRs, bottom to top. */
  prs: PullRequest[]
}

/** Thrown when forkstack answers with an error status. */
export type ApiError = Error & { status: number }

// Points the CLI at a local `pnpm run dev` server while working on forkstack.
const BASE_URL = process.env.FORKSTACK_URL ?? 'https://forkstack.dev'

export function listStacks(): Promise<StackSummary[]> {
  return request('GET', '/api/stacks')
}

export function getStack(id: string): Promise<Stack> {
  return request('GET', `/api/stacks/${id}`)
}

// The server checks the PRs form this stack on GitHub before it saves it, then posts its comment on each PR.
export async function createStack(prIds: string[]): Promise<string> {
  const { id } = await request<{ id: string }>('POST', '/api/stacks', { prIds })
  return id
}

// The PRs stay open. Only the stack and its comments go away.
export function deleteStack(id: string): Promise<void> {
  return request('DELETE', `/api/stacks/${id}`)
}

// The server knows the user by the token of `gh`, and never stores it.
async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers = { authorization: `bearer ${await ghToken()}`, 'content-type': 'application/json' }
  const response = await fetch(new URL(path, BASE_URL), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  }).catch((error: unknown) => {
    throw new Error(`Can't reach forkstack at ${BASE_URL}.`, { cause: error })
  })

  // Errors come back as a sentence for the user, such as asking them to sign in on the web once.
  if (!response.ok) {
    throw Object.assign(new Error(`forkstack: ${await response.text()}`), {
      status: response.status
    })
  }
  const text = await response.text()
  return (text ? JSON.parse(text) : undefined) as T
}
