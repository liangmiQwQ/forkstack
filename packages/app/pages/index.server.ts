import { defineHandler, defineHead } from 'void'
import type { InferProps } from 'void'
import { getUser } from 'void/auth'

export type Props = InferProps<typeof loader>

const DESCRIPTION =
  'Open stacked pull requests from your fork. forkstack links the stack, gives reviewers a diff of each step, and rebases the rest after every merge.'

export const loader = defineHandler(() => ({ signedIn: Boolean(getUser()) }))

export const head = defineHead(() => ({
  title: 'Stacked pull requests from forks',
  meta: [
    { name: 'description', content: DESCRIPTION },
    { property: 'og:title', content: 'forkstack' },
    { property: 'og:description', content: DESCRIPTION },
    { property: 'og:url', content: 'https://forkstack.dev' }
  ]
}))
