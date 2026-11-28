import { expect, it } from 'vite-plus/test'

import { planLayers, rebaseTargets } from '../src/restack-plan.ts'
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
    { prId: '1', baseOid: 'main', commits: [{ oid: 'squashed', parent: 'main' }] },
    {
      prId: '2',
      baseOid: 'old-1b',
      commits: [
        { oid: '2a', parent: 'old-1b' },
        { oid: '2b', parent: '2a' }
      ]
    }
  ])
})

it("finds the parent's current head when the layer was restacked by hand", () => {
  const plans = planLayers([layer('1', ['main', '1a']), layer('2', ['main', '1a', '2a'])], 0)

  expect(plans).toMatchObject([
    { commits: [{ oid: '1a' }] },
    { baseOid: '1a', commits: [{ oid: '2a' }] }
  ])
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

  expect(plans).toMatchObject([{ prId: '2', baseOid: '1b', commits: [{ oid: '2a' }] }])
})

it('leaves out a merge of the parent, and rebases the layer though nothing below it moved', () => {
  const parent = layer('1', ['main', '1a', '1b'])
  const child: LayerState = {
    prId: '2',
    ref: 'branch-2',
    headOid: '2b',
    pastHeads: [],
    commits: new Map([
      ['2a', ['1a']],
      ['merge', ['2a', '1b']],
      ['2b', ['merge']]
    ])
  }

  const plans = planLayers([parent, child], 0)
  if ('ambiguous' in plans) {
    throw new Error('Expected the parent merge to be planned')
  }
  expect(plans[1]).toMatchObject({
    baseOid: '1a',
    commits: [
      { oid: '2a', parent: '1a' },
      { oid: '2b', parent: 'merge' }
    ],
    flatten: { merge: 'merge', tip: '1b' }
  })
  expect(rebaseTargets(plans, 'main')).toEqual({ onMain: true, layersOnly: true })
})

it.each([
  { name: 'something other than the parent', parents: ['2a', 'other'] },
  { name: 'several branches at once', parents: ['2a', '1a', 'other'] }
])('names the merge that stops planning when a layer merged $name', ({ parents }) => {
  const child: LayerState = {
    prId: '2',
    ref: 'branch-2',
    headOid: 'merge',
    pastHeads: [],
    commits: new Map([
      ['2a', ['1a']],
      ['merge', parents]
    ])
  }

  expect(planLayers([layer('1', ['main', '1a']), child], 0)).toEqual({
    ambiguous: 1,
    merge: 'merge'
  })
})

it.each([
  { main: 'base', parent: 'a', merged: 0, onMain: false, layersOnly: false },
  { main: 'new-base', parent: 'a', merged: 0, onMain: true, layersOnly: false },
  { main: 'base', parent: 'old-a', merged: 0, onMain: true, layersOnly: true },
  { main: 'squashed-a', parent: 'a', merged: 1, onMain: true, layersOnly: true }
])('checks both rebase targets against $main and parent $parent (merged: $merged)', scenario => {
  const plans = planLayers(
    [layer('1', ['base', 'a'], ['old-a']), layer('2', ['base', scenario.parent, 'b'])],
    scenario.merged
  )
  if ('ambiguous' in plans) {
    throw new Error('Expected a linear stack')
  }
  expect(rebaseTargets(plans, scenario.main)).toEqual({
    onMain: scenario.onMain,
    layersOnly: scenario.layersOnly
  })
})

it('only rebases onto the base branch once the lowest open layer left its merged parent', () => {
  const plans = planLayers([layer('1', ['base', 'a']), layer('2', ['squashed-a', 'b'])], 1)
  if ('ambiguous' in plans) {
    throw new Error('Expected a linear stack')
  }

  expect(rebaseTargets(plans, 'new-base')).toEqual({ onMain: true, layersOnly: false })
})
