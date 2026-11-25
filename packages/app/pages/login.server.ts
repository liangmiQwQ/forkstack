import { defineHandler, defineHead } from 'void'
import type { InferProps } from 'void'
import { getUser } from 'void/auth'
import type { Href } from 'void/routes'

export type Props = InferProps<typeof loader>

export const loader = defineHandler(c => {
  const next = readNext(c.req.query('next'), c.req.url)
  if (getUser()) {
    return c.redirect(next as Href)
  }
  // Better Auth sends failed sign-ins back here with an `error` code.
  return { error: c.req.query('error') ?? null, next }
})

// Only a path on this site, so a crafted link can't send users elsewhere after they sign in.
function readNext(next: string | undefined, requestUrl: string) {
  const requested = new URL(next ?? '/dashboard', requestUrl)
  return requested.origin === new URL(requestUrl).origin
    ? `${requested.pathname}${requested.search}`
    : '/dashboard'
}

export const head = defineHead(() => ({ title: 'Sign in' }))
