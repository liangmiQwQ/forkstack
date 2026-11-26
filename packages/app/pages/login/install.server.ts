import { defineHandler, defineHead } from 'void'
import type { InferProps } from 'void'
import { requireAuth } from 'void/auth'
import { env } from 'void/env'
import type { Href } from 'void/routes'

import { getGithubToken } from '../../src/account.ts'
import { isInstalledFor } from '../../src/github-app.ts'
import { fetchLogin } from '../../src/github.ts'
import { readNext } from '../../src/next-path.ts'

export type Props = InferProps<typeof loader>

// The second step of signing in. The app's Setup URL on GitHub points back here, so users move on once it is installed.
export const loader = defineHandler(async c => {
  const user = requireAuth(c, { throwRedirect: '/login' })
  const next = readNext(c.req.query('next'), c.req.url)
  const login = await fetchLogin(await getGithubToken(c, user.id))
  if (await isInstalledFor(login)) {
    return c.redirect(next as Href)
  }

  return {
    login,
    next,
    installUrl: `https://github.com/apps/${env.GITHUB_APP_SLUG}/installations/new`
  }
})

export const head = defineHead(() => ({ title: 'Install the GitHub App' }))
