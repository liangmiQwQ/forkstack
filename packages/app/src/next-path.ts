// Only a path on this site, so a crafted link can't send users elsewhere after they sign in.
export function readNext(next: string | undefined, requestUrl: string) {
  const requested = new URL(next ?? '/dashboard', requestUrl)
  return requested.origin === new URL(requestUrl).origin
    ? `${requested.pathname}${requested.search}`
    : '/dashboard'
}
