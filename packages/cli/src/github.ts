import type { PullRequest } from '@forkstack/core/discovery'

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

// The newest PR comes first, since a branch name can be reused after its old PR closed.
const LATEST_PR_STATE_QUERY = /* GraphQL */ `
  query ($owner: String!, $name: String!, $ref: String!) {
    repository(owner: $owner, name: $name) {
      pullRequests(headRefName: $ref, first: 100, orderBy: { field: CREATED_AT, direction: DESC }) {
        nodes {
          state
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

interface LatestPrStateResult {
  repository: {
    pullRequests: {
      nodes: { state: PullRequest['state']; headRepository: { nameWithOwner: string } | null }[]
    }
  }
}

export async function findOpenPr(remotes: Remotes, branch: string): Promise<PrRef | null> {
  const [owner, name] = remotes.upstream.split('/')
  const result = await graphql<HeadPrsResult>(HEAD_PRS_QUERY, { owner, name, ref: branch })
  const pr = result.repository.pullRequests.nodes.find(pr => isFrom(pr.headRepository, remotes))
  return pr ? { id: pr.id, number: pr.number, url: pr.url } : null
}

// A branch without a PR yet counts as open, since it still needs rebasing.
export async function findPrState(remotes: Remotes, branch: string): Promise<PullRequest['state']> {
  const [owner, name] = remotes.upstream.split('/')
  const result = await graphql<LatestPrStateResult>(LATEST_PR_STATE_QUERY, {
    owner,
    name,
    ref: branch
  })
  const pr = result.repository.pullRequests.nodes.find(pr => isFrom(pr.headRepository, remotes))
  return pr?.state ?? 'OPEN'
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

// Other forks may have a branch with the same name, so only PRs from the user's fork count.
function isFrom(repo: { nameWithOwner: string } | null, remotes: Remotes) {
  return repo?.nameWithOwner.toLowerCase() === remotes.fork.toLowerCase()
}
