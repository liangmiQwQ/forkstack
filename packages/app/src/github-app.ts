import { createAppAuth } from '@octokit/auth-app'
import { request } from '@octokit/request'
import { RequestError } from '@octokit/request-error'
import { env } from 'void/env'

const PUSH_PERMISSIONS = new Set(['admin', 'write'])

// The GitHub App is installed on forks, not on upstream repositories, so its tokens can only write to the fork's branches.
// Returns `null` when the app is not installed on the repository.
export async function getRepoToken(repo: string): Promise<string | null> {
  const [owner, name] = repo.split('/')
  const auth = createAuth()
  const headers = await appHeaders(auth)

  const installation = await nullIfNotFound(
    request('GET /repos/{owner}/{repo}/installation', { owner, repo: name, headers })
  )
  if (installation === null) {
    return null
  }

  // Scoped to the one repository, so a bug can't touch the user's other repositories.
  const { token } = await auth({
    type: 'installation',
    installationId: installation.data.id,
    repositoryNames: [name]
  })
  return token
}

// The app can stay installed after the stack's owner loses access to a shared fork, so its token alone doesn't prove the owner may push.
export async function canPush(token: string, repo: string, githubId: string): Promise<boolean> {
  const [owner, name] = repo.split('/')
  const api = request.defaults({ headers: { authorization: `token ${token}` } })
  const { data: user } = await api('GET /user/{account_id}', { account_id: Number(githubId) })
  const access = await nullIfNotFound(
    api('GET /repos/{owner}/{repo}/collaborators/{username}/permission', {
      owner,
      repo: name,
      username: user.login
    })
  )
  // The legacy `permission` field folds maintain into write and triage into read.
  return access !== null && PUSH_PERMISSIONS.has(access.data.permission)
}

// True once the user installs the app on their account, whichever repositories they pick.
export async function isInstalledFor(login: string): Promise<boolean> {
  const headers = await appHeaders(createAuth())
  const installation = await nullIfNotFound(
    request('GET /users/{username}/installation', { username: login, headers })
  )
  return installation !== null
}

function createAuth() {
  return createAppAuth({
    appId: env.GITHUB_APP_ID,
    privateKey: env.GITHUB_APP_PRIVATE_KEY
  })
}

async function appHeaders(auth: ReturnType<typeof createAuth>) {
  const { token } = await auth({ type: 'app' })
  return { authorization: `bearer ${token}` }
}

// GitHub answers 404 when the app has no installation there.
async function nullIfNotFound<T>(response: Promise<T>): Promise<T | null> {
  try {
    return await response
  } catch (error) {
    if (error instanceof RequestError && error.status === 404) {
      return null
    }
    throw error
  }
}
