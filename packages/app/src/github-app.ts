import { createAppAuth } from '@octokit/auth-app'
import { request } from '@octokit/request'
import { RequestError } from '@octokit/request-error'
import { env } from 'void/env'

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
