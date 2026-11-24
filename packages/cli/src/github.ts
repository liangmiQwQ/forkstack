import { graphql } from './gh.ts'
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
