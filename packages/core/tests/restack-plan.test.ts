import { expect, it } from 'vite-plus/test'

import { planLayers } from '../src/restack-plan.ts'
import type { LayerState } from '../src/restack-plan.ts'

// A linear branch: `chain[0]` is the commit it starts from, which is not on the branch itself.
function layer(prId: string, chain: string[], pastHeads: string[] = []): LayerState {
  const commits = new Map(chain.slice(1).map((oid, i) => [oid, [chain[i]]]))
  return { prId, ref: `branch-${prId}`, headOid: chain.at(-1)!, commits, pastHeads }
}

it("finds only the layer's own commits after its parent was squashed and force-pushed", () => {
  const plans = planLayers(
    [
      layer('1', ['main', 'squashed'], ['old-1b']),
      layer('2', ['main', 'old-1a', 'old-1b', '2a', '2b'])
    ],
    0
  )

  expect(plans).toMatchObject([
    { prId: '1', baseOid: 'main', commits: ['squashed'] },
    { prId: '2', baseOid: 'old-1b', commits: ['2a', '2b'] }
  ])
})

it("finds the parent's current head when the layer was restacked by hand", () => {
  const plans = planLayers([layer('1', ['main', '1a']), layer('2', ['main', '1a', '2a'])], 0)

  expect(plans).toMatchObject([{ commits: ['1a'] }, { baseOid: '1a', commits: ['2a'] }])
})

it('stops at a layer that never meets any commit its parent had', () => {
  const plans = planLayers(
    [layer('1', ['main', '1a']), layer('2', ['main', 'local-only', '2a'])],
    0
  )

  expect(plans).toEqual({ ambiguous: 1 })
})

it('plans only the open layers after the bottom was squash-merged, without the merged commits', () => {
  const plans = planLayers(
    [layer('1', ['main', '1a', '1b']), layer('2', ['main', '1a', '1b', '2a'])],
    1
  )

  expect(plans).toMatchObject([{ prId: '2', baseOid: '1b', commits: ['2a'] }])
})
