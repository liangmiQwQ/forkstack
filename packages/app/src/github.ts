import { graphql } from '@octokit/graphql'

import type { BodiesByPr, PullRequest } from './discovery.ts'

// GitHub's `nodes(ids:)` accepts at most 100 IDs per call.
const NODES_LIMIT = 100

const SEARCH_QUERY = /* GraphQL */ `
  query ($q: String!, $after: String) {
    search(type: ISSUE, query: $q, first: 100, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        ... on PullRequest {
          id
          number
          title
          url
          baseRefName
          headRefName
          headRefOid
          baseRepository {
            nameWithOwner
          }
          headRepository {
            nameWithOwner
          }
          commits(first: 250) {
            nodes {
              commit {
                oid
              }
            }
          }
        }
      }
    }
  }
`

const BODIES_QUERY = /* GraphQL */ `
  query ($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on PullRequest {
        url
        body
      }
    }
  }
`

interface PullRequestNode {
  id: string
  number: number
  title: string
  url: string
  baseRefName: string
  headRefName: string
  headRefOid: string
  baseRepository: { nameWithOwner: string }
  headRepository: { nameWithOwner: string } | null
  commits: { nodes: { commit: { oid: string } }[] }
}

interface SearchResult {
  search: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null }
    nodes: PullRequestNode[]
  }
}

interface BodiesResult {
  nodes: { url: string; body: string }[]
}

// Repos the user owns are excluded, since a fork stack always merges into someone else's repository.
// `@me` resolves to the token's owner, so the GitHub login never needs to be stored.
export async function searchOpenPrs(token: string): Promise<PullRequest[]> {
  const request = createClient(token)
  const q = 'is:pr is:open author:@me -user:@me archived:false'
  const prs: PullRequest[] = []

  let after: string | null = null
  do {
    const { search }: SearchResult = await request<SearchResult>(SEARCH_QUERY, { q, after })
    prs.push(...search.nodes.map(toPullRequest))
    after = search.pageInfo.hasNextPage ? search.pageInfo.endCursor : null
  } while (after)

  return prs
}

export async function fetchBodies(token: string, prs: PullRequest[]): Promise<BodiesByPr> {
  const request = createClient(token)
  const chunks = Array.from({ length: Math.ceil(prs.length / NODES_LIMIT) }, (_, i) =>
    prs.slice(i * NODES_LIMIT, (i + 1) * NODES_LIMIT)
  )

  const results = await Promise.all(
    chunks.map(chunk => request<BodiesResult>(BODIES_QUERY, { ids: chunk.map(pr => pr.id) }))
  )

  return new Map(results.flatMap(result => result.nodes).map(node => [node.url, node.body]))
}

function createClient(token: string) {
  return graphql.defaults({ headers: { authorization: `token ${token}` } })
}

function toPullRequest(node: PullRequestNode): PullRequest {
  return {
    id: node.id,
    number: node.number,
    title: node.title,
    url: node.url,
    baseRepo: node.baseRepository.nameWithOwner,
    baseRef: node.baseRefName,
    headRepo: node.headRepository?.nameWithOwner ?? null,
    headRef: node.headRefName,
    headOid: node.headRefOid,
    commits: node.commits.nodes.map(({ commit }) => commit.oid)
  }
}
