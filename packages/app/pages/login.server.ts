import { defineHandler, defineHead } from 'void'
import type { InferProps } from 'void'
import { getUser } from 'void/auth'

export type Props = InferProps<typeof loader>

export const loader = defineHandler(c => {
  if (getUser()) {
    return c.redirect('/dashboard')
  }
  // Better Auth sends failed sign-ins back here with an `error` code.
  return { error: c.req.query('error') ?? null }
})

export const head = defineHead(() => ({ title: 'Sign in' }))
