import type { CommentsByPr, PullRequest } from '@forkstack/core/discovery'
import type { LayerState } from '@forkstack/core/restack-plan'
import { countMerged } from '@forkstack/core/stack-health'
import { graphql, GraphqlResponseError } from '@octokit/graphql'

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
    state
    isDraft
    reviewDecision
    updatedAt
    comments {
      totalCount
    }
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
    lastCommit: commits(last: 1) {
      nodes {
        commit {
          statusCheckRollup {
            state
          }
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

const HEAD_PRS_QUERY = /* GraphQL */ `
  query ($owner: String!, $name: String!, $ref: String!) {
    repository(owner: $owner, name: $name) {
      ref(qualifiedName: $ref) {
        associatedPullRequests(first: 100, states: OPEN) {
          nodes {
            id
          }
        }
      }
    }
  }
`

// Force-pushes come newest last, and a layer is usually built on a recent version of its parent.
const RESTACK_QUERY = /* GraphQL */ `
  query ($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on PullRequest {
        id
        state
        headRefName
        headRefOid
        headRepository {
          id
          nameWithOwner
        }
        baseRef {
          target {
            oid
          }
        }
        commits(first: 250) {
          totalCount
          nodes {
            commit {
              oid
              parents(first: 2) {
                nodes {
                  oid
                }
              }
            }
          }
        }
        timelineItems(itemTypes: [HEAD_REF_FORCE_PUSHED_EVENT], last: 100) {
          nodes {
            ... on HeadRefForcePushedEvent {
              beforeCommit {
                oid
              }
            }
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

const UPDATE_COMMENT_MUTATION = /* GraphQL */ `
  mutation ($id: ID!, $body: String!) {
    updateIssueComment(input: { id: $id, body: $body }) {
      clientMutationId
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
  state: PullRequest['state']
  isDraft: boolean
  reviewDecision: PullRequest['reviewDecision']
  updatedAt: string
  comments: { totalCount: number }
  baseRepository: { nameWithOwner: string }
  headRepository: { nameWithOwner: string } | null
  commits: { nodes: { commit: { oid: string } }[] }
  lastCommit: { nodes: { commit: { statusCheckRollup: { state: CheckState } | null } }[] }
}

type CheckState = 'SUCCESS' | 'FAILURE' | 'ERROR' | 'PENDING' | 'EXPECTED'

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

interface HeadPrsResult {
  repository: { ref: { associatedPullRequests: { nodes: { id: string }[] } } | null } | null
}

interface RestackNode {
  id: string
  state: PullRequest['state']
  headRefName: string
  headRefOid: string
  headRepository: { id: string; nameWithOwner: string } | null
  baseRef: { target: { oid: string } } | null
  commits: {
    totalCount: number
    nodes: { commit: { oid: string; parents: { nodes: { oid: string }[] } } }[]
  }
  timelineItems: { nodes: { beforeCommit?: { oid: string } | null }[] }
}

export interface RestackState {
  /** `owner/name` of the fork every layer's branch lives in. */
  repo: string
  /** GraphQL node ID of the fork. */
  repositoryId: string
  /** Head of the branch the stack merges into. */
  mainOid: string
  /** How many layers at the bottom were merged already. */
  merged: number
  /** The stack's layers, bottom to top. */
  layers: LayerState[]
}

interface AddCommentResult {
  addComment: { commentEdge: { node: { id: string } } }
}

// A node is `null` when its PR was deleted.
interface NodesResult<T> {
  nodes: (T | null)[]
}

// Repos the user owns are excluded, since a fork stack always merges into someone else's repository.
// Private repos are excluded, since the stack status image is served to anyone who has its URL.
// `@me` resolves to the token's owner, so the GitHub login never needs to be stored.
export async function searchOpenPrs(token: string): Promise<PullRequest[]> {
  const request = createClient(token)
  const q = 'is:pr is:open is:public author:@me -user:@me archived:false'
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

// Includes PRs into other repositories, so a fork branch finds its PRs to upstream.
export async function findPrIdsByHead(token: string, repo: string, ref: string): Promise<string[]> {
  const [owner, name] = repo.split('/')
  const result = await createClient(token)<HeadPrsResult>(HEAD_PRS_QUERY, { owner, name, ref })
  return result.repository?.ref?.associatedPullRequests.nodes.map(pr => pr.id) ?? []
}

// Returns `null` when a restack can't be done from GitHub's data: the stack is broken, or a PR has more commits than one request returns.
export async function fetchRestackState(
  token: string,
  ids: string[]
): Promise<RestackState | null> {
  const nodes = await requestNodes<RestackNode>(token, RESTACK_QUERY, ids)
  const byId = new Map(nodes.map(node => [node.id, node]))
  const stack = ids.map(id => byId.get(id))

  const [bottom] = stack
  // A deleted PR is gone from the stack like a closed one.
  const merged = countMerged(stack.map(node => node?.state ?? 'CLOSED'))
  const complete = stack.every(node => node?.commits.totalCount === node?.commits.nodes.length)
  if (merged === null || !complete || !bottom?.headRepository || !bottom.baseRef) {
    return null
  }

  return {
    repo: bottom.headRepository.nameWithOwner,
    repositoryId: bottom.headRepository.id,
    mainOid: bottom.baseRef.target.oid,
    merged,
    layers: stack.map(node => toLayerState(node!))
  }
}

export async function addComment(token: string, subjectId: string, body: string): Promise<string> {
  const result = await createClient(token)<AddCommentResult>(ADD_COMMENT_MUTATION, {
    subjectId,
    body
  })
  return result.addComment.commentEdge.node.id
}

export async function updateComment(token: string, id: string, body: string): Promise<void> {
  try {
    await createClient(token)(UPDATE_COMMENT_MUTATION, { id, body })
  } catch (error) {
    // A maintainer may have deleted the comment, and the stack still works without it.
    if (!isNotFound(error)) {
      throw error
    }
  }
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
    commits: node.commits.nodes.map(({ commit }) => commit.oid),
    state: node.state,
    isDraft: node.isDraft,
    reviewDecision: node.reviewDecision,
    updatedAt: node.updatedAt,
    comments: node.comments.totalCount,
    checks: toChecks(node.lastCommit.nodes[0]?.commit.statusCheckRollup?.state)
  }
}

function toLayerState(node: RestackNode): LayerState {
  return {
    prId: node.id,
    ref: node.headRefName,
    headOid: node.headRefOid,
    commits: new Map(
      node.commits.nodes.map(({ commit }) => [commit.oid, commit.parents.nodes.map(p => p.oid)])
    ),
    pastHeads: node.timelineItems.nodes.flatMap(event => event.beforeCommit?.oid ?? [])
  }
}

// GitHub has five rollup states, and the page only needs to tell passing, failing, and running checks apart.
function toChecks(state: CheckState | undefined): PullRequest['checks'] {
  switch (state) {
    case 'SUCCESS': {
      return 'passing'
    }
    case 'FAILURE':
    case 'ERROR': {
      return 'failing'
    }
    case 'PENDING':
    case 'EXPECTED': {
      return 'running'
    }
    default: {
      return null
    }
  }
}
