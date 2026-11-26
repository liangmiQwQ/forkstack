import { defineHandler, defineHead } from 'void'
import type { InferProps } from 'void'
import { getUser } from 'void/auth'
import type { Href } from 'void/routes'

import { readNext } from '../src/next-path.ts'

export type Props = InferProps<typeof loader>

export const loader = defineHandler(c => {
  const next = readNext(c.req.query('next'), c.req.url)
  if (getUser()) {
    return c.redirect(next as Href)
  }
  // Better Auth sends failed sign-ins back here with an `error` code.
  return { error: c.req.query('error') ?? null, next }
})

export const head = defineHead(() => ({ title: 'Sign in' }))
