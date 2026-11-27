// `@login` matches what GitHub shows next to a PR. The display name fills in until the next sign-in stores the login.
export function formatIdentity(login: string | null, name: string) {
  return login ? `@${login}` : name
}
