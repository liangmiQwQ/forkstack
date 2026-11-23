import { createAppAuth } from '@octokit/auth-app'
import { request } from '@octokit/request'
import { RequestError } from '@octokit/request-error'
import { env } from 'void/env'

// The GitHub App is installed on forks, not on upstream repositories, so its tokens can only write to the fork's branches.
// Returns `null` when the app is not installed on the repository.
export async function getRepoToken(repo: string): Promise<string | null> {
  const [owner, name] = repo.split('/')
  const auth = createAppAuth({
    appId: env.GITHUB_APP_ID,
    privateKey: env.GITHUB_APP_PRIVATE_KEY
  })

  const installationId = await findInstallationId(await auth({ type: 'app' }), owner, name)
  if (installationId === null) {
    return null
  }

  // Scoped to the one repository, so a bug can't touch the user's other repositories.
  const { token } = await auth({ type: 'installation', installationId, repositoryNames: [name] })
  return token
}

async function findInstallationId(appAuth: { token: string }, owner: string, repo: string) {
  try {
    const { data } = await request('GET /repos/{owner}/{repo}/installation', {
      owner,
      repo,
      headers: { authorization: `bearer ${appAuth.token}` }
    })
    return data.id
  } catch (error) {
    if (error instanceof RequestError && error.status === 404) {
      return null
    }
    throw error
  }
}
