import { HTTPException } from 'hono/http-exception'
import { defineHandler, defineHead } from 'void'
import { getUser } from 'void/auth'

const DESCRIPTION =
  'Open stacked pull requests from your fork. forkstack links the stack, gives reviewers a diff of each step, and rebases the rest after every merge.'

// Signed-in users come here for their stacks, not the pitch.
export const loader = defineHandler(c => {
  if (getUser()) {
    throw new HTTPException(302, { res: c.redirect('/dashboard') })
  }
})

export const head = defineHead(() => ({
  title: 'Stacked pull requests from forks',
  meta: [
    { name: 'description', content: DESCRIPTION },
    { property: 'og:title', content: 'forkstack' },
    { property: 'og:description', content: DESCRIPTION },
    { property: 'og:url', content: 'https://forkstack.dev' }
  ]
}))
