import { HTTPException } from 'hono/http-exception'
import * as v from 'valibot'
import { defineHandler, defineHead } from 'void'
import type { CloudContext, InferProps } from 'void'
import { requireAuth } from 'void/auth'

import { getGithubToken } from '../../../src/account.ts'
import { fetchCommitEmails } from '../../../src/commit-emails.ts'
import {
  createSigningKey,
  deleteSigningKey,
  findSigningKey,
  isSigningConfigured
} from '../../../src/signing-key.ts'

export type Props = InferProps<typeof loader>

export const loader = defineHandler(async c => {
  const user = requireAuth(c, { throwRedirect: '/login' })
  const signingKey = (await findSigningKey(user.id)) ?? null
  const configured = isSigningConfigured()
  return {
    signingKey,
    configured,
    // Only needed to pick the email of a new key.
    emails: signingKey || !configured ? [] : await readCommitEmails(c, user.id)
  }
})

export const actions = {
  create: defineHandler.withValidator({
    body: v.object({ email: v.string() })
  })(async (c, { body }) => {
    const user = requireAuth(c)
    if (!(await readCommitEmails(c, user.id)).includes(body.email)) {
      throw new HTTPException(400, {
        message: 'Pick an email that is verified on your GitHub account.'
      })
    }
    // GitHub matches only the email. The name is what the commit shows as its committer.
    await createSigningKey(user.id, {
      // The display name is often blank.
      name: user.name || (user.login ?? body.email),
      email: body.email
    })
  }),

  remove: defineHandler(async c => {
    const user = requireAuth(c)
    await deleteSigningKey(user.id)
  })
}

export const head = defineHead(() => ({ title: 'Signing key' }))

async function readCommitEmails(c: CloudContext, userId: string) {
  return fetchCommitEmails(await getGithubToken(c, userId))
}
