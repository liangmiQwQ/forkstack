import type { LayerState } from '@forkstack/core/restack-plan'

import { git } from './git.ts'
import type { LocalBranch } from './local-stack.ts'

// Reads what `planLayers` needs from the local repository, so a local rebase finds the same layer boundaries as the server.
export async function readLayerState(branch: LocalBranch, trunkOid: string): Promise<LayerState> {
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
    pastHeads: branch.pastHeads
  }
}
