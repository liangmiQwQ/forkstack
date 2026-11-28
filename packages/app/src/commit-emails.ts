import { request } from '@octokit/request'

// GitHub verifies a signed commit only when its committer email is verified on the signer's account.
// The noreply address always is, and keeps a private email out of public commits, so it comes first.
// Sign-in already grants `user:email`, since Better Auth asks for it by default.
export async function fetchCommitEmails(token: string): Promise<string[]> {
  const api = request.defaults({ headers: { authorization: `token ${token}` } })
  const [{ data: user }, { data: emails }] = await Promise.all([
    api('GET /user'),
    api('GET /user/emails')
  ])
  const noreply = `${user.id}+${user.login}@users.noreply.github.com`
  return [
    ...new Set([noreply, ...emails.filter(email => email.verified).map(email => email.email)])
  ]
}
