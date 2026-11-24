import { gh, graphql } from './gh.ts'
import type { Remotes } from './remotes.ts'

export interface PrRef {
  /** GitHub's GraphQL node ID. */
  id: string
  number: number
  url: string
}

const HEAD_PRS_QUERY = /* GraphQL */ `
  query ($owner: String!, $name: String!, $ref: String!) {
    repository(owner: $owner, name: $name) {
      pullRequests(headRefName: $ref, states: OPEN, first: 100) {
        nodes {
          id
          number
          url
          headRepository {
            nameWithOwner
          }
        }
      }
    }
  }
`

interface HeadPrsResult {
  repository: {
    pullRequests: { nodes: (PrRef & { headRepository: { nameWithOwner: string } | null })[] }
  }
}

// Other forks may have a branch with the same name, so only the PR from the user's fork counts.
export async function findOpenPr(remotes: Remotes, branch: string): Promise<PrRef | null> {
  const [owner, name] = remotes.upstream.split('/')
  const result = await graphql<HeadPrsResult>(HEAD_PRS_QUERY, { owner, name, ref: branch })
  const pr = result.repository.pullRequests.nodes.find(
    pr => pr.headRepository?.nameWithOwner.toLowerCase() === remotes.fork.toLowerCase()
  )
  return pr ? { id: pr.id, number: pr.number, url: pr.url } : null
}

// A fork branch can't be the base of an upstream PR, so every PR in a stack merges into the trunk.
export async function createPr(
  remotes: Remotes,
  base: string,
  branch: string,
  options: { title: string; body: string; draft: boolean }
): Promise<PrRef> {
  const owner = remotes.fork.split('/')[0]
  const args = ['--repo', remotes.upstream, '--base', base, '--head', `${owner}:${branch}`]
  const content = ['--title', options.title, '--body', options.body]
  const url = await gh(['pr', 'create', ...args, ...content, ...(options.draft ? ['--draft'] : [])])
  return JSON.parse(await gh(['pr', 'view', url, '--json', 'id,number,url'])) as PrRef
}
