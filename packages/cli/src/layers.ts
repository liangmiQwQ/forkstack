import type { LayerState } from '@forkstack/core/restack-plan'

import { git } from './git.ts'
import type { LocalBranch } from './local-stack.ts'

// Reads what `planLayers` needs from the local repository, so a local rebase finds the same layer boundaries as the server.
export async function readLayerState(
  branch: LocalBranch,
  trunkOid: string,
  forkRemote: string
): Promise<LayerState> {
  const commits = await git('rev-list', '--parents', `${trunkOid}..${branch.headOid}`)
  return {
    prId: branch.name,
    ref: branch.name,
    headOid: branch.headOid,
    commits: new Map(
      commits
        .split('\n')
        .filter(Boolean)
        .map(line => {
          const [oid, ...parents] = line.split(' ')
          return [oid, parents]
        })
    ),
    pastHeads: [...branch.pastHeads, ...(await readPushedHead(branch.name, forkRemote))]
  }
}

// The server reads past heads from force-pushes on GitHub. Locally, the reflog holds every head the branch had, plus the one last pushed.
async function readPushedHead(name: string, forkRemote: string) {
  const ref = `refs/remotes/${forkRemote}/${name}`
  const oid = await git('rev-parse', '--verify', '--quiet', ref).catch(() => null)
  return oid ? [oid] : []
}
