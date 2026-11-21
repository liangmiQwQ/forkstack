import { graphql, GraphqlResponseError } from '@octokit/graphql'

import type { CommentsByPr, PullRequest } from './discovery.ts'

// GitHub's `nodes(ids:)` accepts at most 100 IDs per call.
const NODES_LIMIT = 100

// Shared by the search and by fetching stored PRs, so both return the same `PullRequest` shape.
const PR_FIELDS = /* GraphQL */ `
  fragment PrFields on PullRequest {
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
`

const SEARCH_QUERY = /* GraphQL */ `
  query ($q: String!, $after: String) {
    search(type: ISSUE, query: $q, first: 100, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        ...PrFields
      }
    }
  }
  ${PR_FIELDS}
`

const PRS_QUERY = /* GraphQL */ `
  query ($ids: [ID!]!) {
    nodes(ids: $ids) {
      ...PrFields
    }
  }
  ${PR_FIELDS}
`

// Only the first 100 comments are read. The marker is posted when a stack is created, so it is rarely further down.
const COMMENTS_QUERY = /* GraphQL */ `
  query ($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on PullRequest {
        url
        comments(first: 100) {
          nodes {
            body
            viewerDidAuthor
          }
        }
      }
    }
  }
`

const ADD_COMMENT_MUTATION = /* GraphQL */ `
  mutation ($subjectId: ID!, $body: String!) {
    addComment(input: { subjectId: $subjectId, body: $body }) {
      commentEdge {
        node {
          id
        }
      }
    }
  }
`

const DELETE_COMMENT_MUTATION = /* GraphQL */ `
  mutation ($id: ID!) {
    deleteIssueComment(input: { id: $id }) {
      clientMutationId
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

interface CommentsNode {
  url: string
  comments: { nodes: { body: string; viewerDidAuthor: boolean }[] }
}

interface AddCommentResult {
  addComment: { commentEdge: { node: { id: string } } }
}

// A node is `null` when its PR was deleted.
interface NodesResult<T> {
  nodes: (T | null)[]
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

export async function fetchPrs(token: string, ids: string[]): Promise<PullRequest[]> {
  const nodes = await requestNodes<PullRequestNode>(token, PRS_QUERY, ids)
  return nodes.map(toPullRequest)
}

export async function fetchViewerComments(
  token: string,
  prs: PullRequest[]
): Promise<CommentsByPr> {
  const nodes = await requestNodes<CommentsNode>(
    token,
    COMMENTS_QUERY,
    prs.map(pr => pr.id)
  )
  return new Map(
    nodes.map(node => [
      node.url,
      node.comments.nodes.filter(comment => comment.viewerDidAuthor).map(comment => comment.body)
    ])
  )
}

export async function addComment(token: string, subjectId: string, body: string): Promise<string> {
  const result = await createClient(token)<AddCommentResult>(ADD_COMMENT_MUTATION, {
    subjectId,
    body
  })
  return result.addComment.commentEdge.node.id
}

export async function deleteComment(token: string, id: string): Promise<void> {
  try {
    await createClient(token)(DELETE_COMMENT_MUTATION, { id })
  } catch (error) {
    // A maintainer may have deleted the comment already, which leaves nothing to do.
    if (!isNotFound(error)) {
      throw error
    }
  }
}

async function requestNodes<T>(token: string, query: string, ids: string[]): Promise<T[]> {
  const request = createClient(token)
  const chunks = Array.from({ length: Math.ceil(ids.length / NODES_LIMIT) }, (_, i) =>
    ids.slice(i * NODES_LIMIT, (i + 1) * NODES_LIMIT)
  )

  const results = await Promise.all(
    chunks.map(chunk => request<NodesResult<T>>(query, { ids: chunk }))
  )

  return results.flatMap(result => result.nodes).filter(node => node !== null)
}

function createClient(token: string) {
  return graphql.defaults({ headers: { authorization: `token ${token}` } })
}

function isNotFound(error: unknown) {
  return error instanceof GraphqlResponseError && error.errors?.every(e => e.type === 'NOT_FOUND')
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
