import { setTimeout } from 'node:timers/promises'

import { spinner } from '@clack/prompts'
import { define } from 'gunshi'
import open from 'open'
import c from 'picocolors'

import { getUser, LOGIN_URL } from '../api.ts'
import type { ApiError, User } from '../api.ts'
import { gh } from '../gh.ts'

const POLL_DELAY_MS = 2000

// The CLI keeps sending the token of `gh`, so signing in only has to create the forkstack account on the web.
export const login = define({
  name: 'login',
  description: 'Sign in to forkstack in the browser with the GitHub account of gh',
  run: async () => {
    const user = (await findUser()) ?? (await signInOnWeb())
    console.log(c.green(`Signed in to forkstack as ${user.name}.`))
  }
})

async function signInOnWeb(): Promise<User> {
  const githubLogin = await gh(['api', 'user', '--jq', '.login'])
  console.log(`Sign in as ${c.bold(githubLogin)} at ${c.cyan(LOGIN_URL)}`)
  // The URL is printed too, for machines without a browser, such as over SSH.
  await open(LOGIN_URL).catch(() => null)

  const waiting = spinner()
  waiting.start('Waiting for you to sign in')
  for (;;) {
    await setTimeout(POLL_DELAY_MS)
    const user = await findUser()
    if (user) {
      waiting.stop('Signed in')
      return user
    }
  }
}

async function findUser(): Promise<User | null> {
  try {
    return await getUser()
  } catch (error) {
    if ((error as ApiError).status === 403) {
      return null
    }
    throw error
  }
}
