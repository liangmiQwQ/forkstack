import { graphql } from '@octokit/graphql'
import { request } from '@octokit/request'
import { RequestError } from '@octokit/request-error'

export interface Commit {
  oid: string
  tree: string
  message: string
  author: { name: string; email: string; date: string }
}

export interface RefUpdate {
  /** Branch name, without `refs/heads/`. */
  ref: string
  beforeOid: string
  afterOid: string
}

const UPDATE_REFS_MUTATION = /* GraphQL */ `
  mutation ($repositoryId: ID!, $refUpdates: [RefUpdate!]!) {
    updateRefs(input: { repositoryId: $repositoryId, refUpdates: $refUpdates }) {
      clientMutationId
    }
  }
`

// Git operations on one repository, done through GitHub's API since Workers can't run git.
export function createGit(token: string, repo: string) {
  const [owner, name] = repo.split('/')
  const api = request.defaults({ headers: { authorization: `token ${token}` } })
  const target = { owner, repo: name }

  return {
    async getCommit(oid: string): Promise<Commit> {
      const { data } = await api('GET /repos/{owner}/{repo}/git/commits/{commit_sha}', {
        ...target,
        commit_sha: oid
      })
      return { oid, tree: data.tree.sha, message: data.message, author: data.author }
    },

    async createCommit(tree: string, parent: string, message: string, author?: Commit['author']) {
      const { data } = await api('POST /repos/{owner}/{repo}/git/commits', {
        ...target,
        tree,
        parents: [parent],
        message,
        author
      })
      return data.sha
    },

    async createBranch(ref: string, oid: string): Promise<void> {
      await api('POST /repos/{owner}/{repo}/git/refs', {
        ...target,
        ref: `refs/heads/${ref}`,
        sha: oid
      })
    },

    async moveBranch(ref: string, oid: string): Promise<void> {
      await api('PATCH /repos/{owner}/{repo}/git/refs/{ref}', {
        ...target,
        ref: `heads/${ref}`,
        sha: oid,
        force: true
      })
    },

    async deleteBranch(ref: string): Promise<void> {
      await api('DELETE /repos/{owner}/{repo}/git/refs/{ref}', { ...target, ref: `heads/${ref}` })
    },

    // Returns the merged tree, or `null` when the merge conflicts.
    async merge(branch: string, oid: string): Promise<string | null> {
      try {
        const { data } = await api('POST /repos/{owner}/{repo}/merges', {
          ...target,
          base: branch,
          head: oid
        })
        return data.commit.tree.sha
      } catch (error) {
        if (error instanceof RequestError && error.status === 409) {
          return null
        }
        throw error
      }
    },

    // All branches move together or none do. `beforeOid` rejects the update if the user pushed since the restack started.
    async updateBranches(repositoryId: string, updates: RefUpdate[]): Promise<void> {
      await graphql(UPDATE_REFS_MUTATION, {
        headers: { authorization: `token ${token}` },
        repositoryId,
        refUpdates: updates.map(update => ({
          name: `refs/heads/${update.ref}`,
          beforeOid: update.beforeOid,
          afterOid: update.afterOid,
          force: true
        }))
      })
    }
  }
}

export type Git = ReturnType<typeof createGit>
