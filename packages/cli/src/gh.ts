import which from 'which'

import { exec } from './exec.ts'

// `gh` sets `GH_PATH` when it runs forkstack as an extension, so the same `gh` is used then.
const GH = process.env.GH_PATH ?? 'gh'

const INSTALL_GH =
  'forkstack needs the GitHub CLI. Install it from https://cli.github.com, then run `gh auth login`.'

let token: Promise<string> | undefined

export async function gh(args: string[], stdin?: string): Promise<string> {
  try {
    return await exec(GH, args, stdin)
  } catch (error) {
    // On Windows, tinyexec can report a missing command as a shell exit instead of ENOENT.
    if (!(await which(GH, { nothrow: true }))) {
      throw new Error(INSTALL_GH, { cause: error })
    }
    throw error
  }
}

// The server accepts the token of `gh` as the user's forkstack login, so there is no login of its own.
export function ghToken(): Promise<string> {
  token ??= readToken()
  return token
}

// The query goes through stdin, so variables keep their JSON types, such as lists of IDs.
export async function graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const output = await gh(['api', 'graphql', '--input', '-'], JSON.stringify({ query, variables }))
  return (JSON.parse(output) as { data: T }).data
}

async function readToken() {
  try {
    return await gh(['auth', 'token'])
  } catch (error) {
    throw new Error('Sign in to the GitHub CLI with `gh auth login` first.', { cause: error })
  }
}
