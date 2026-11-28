// What a restack needs to know about one PR, read from GitHub when the restack starts.
export interface LayerState {
  prId: string
  /** Branch name in the fork. */
  ref: string
  headOid: string
  /** Each commit on the PR's branch, mapped to its parents' hashes. */
  commits: Map<string, string[]>
  /** Head commits the branch had before each force-push, from the PR's timeline. */
  pastHeads: string[]
}

export interface LayerPlan {
  prId: string
  ref: string
  headOid: string
  /** The commit the layer's own commits sit on. */
  baseOid: string
  /** The layer's own commits, bottom to top, each with the parent its changes are taken against. */
  commits: { oid: string; parent: string }[]
  /** Whether those commits sit on the parent's, rather than on the base branch. */
  onParent: boolean
  /** Set when the layer ran `git merge` of its parent. The merge is left out of `commits`, and `tip` is the parent commit it brought in. */
  flatten?: { merge: string; tip: string }
}

// Nothing about a stack is stored between restacks, since users force-push, squash and restack by hand outside forkstack.
// Each layer's own commits are found again from what GitHub knows now: the commits above the newest parent commit in its branch.
// The first `merged` layers were merged already. They aren't planned, but still mark where the lowest open layer's commits start.
// Returns the index of the first layer whose commits can't be told apart from its parent's, so the user restacks it by hand.
// `merge` is the merge commit that stopped planning, when one did.
export function planLayers(
  layers: LayerState[],
  merged: number
): LayerPlan[] | { ambiguous: number; merge?: string } {
  const plans: LayerPlan[] = []

  for (const [index, layer] of layers.entries()) {
    if (index < merged) {
      continue
    }

    const plan = planLayer(layer, layers[index - 1], index === merged)
    if (!('prId' in plan)) {
      return { ambiguous: index, ...plan }
    }
    plans.push(plan)
  }

  return plans
}

// Once a lower layer moves, the layers above it must follow its new head.
// The lowest open layer also moves while it still sits on a merged parent, since those commits are already in the base branch.
export function rebaseTargets(plans: LayerPlan[], mainOid: string) {
  const baseMoved = plans.length > 0 && plans[0].baseOid !== mainOid
  const layerMoved = plans.some((plan, i) => i > 0 && plan.baseOid !== plans[i - 1].headOid)
  // A layer that merged its parent is rewritten even when nothing below it moved.
  const merges = plans.some(plan => plan.flatten)
  return {
    onMain: baseMoved || layerMoved || merges,
    layersOnly: layerMoved || merges || (baseMoved && plans[0].onParent)
  }
}

// Walks down from the head until it reaches a commit the parent had at some point.
// The lowest open layer may stop at the base branch instead, which is where its PR's commits end.
// That happens when the user rebased it onto the base branch by hand after its parent merged.
function planLayer(
  layer: LayerState,
  parent: LayerState | undefined,
  lowest: boolean
): LayerPlan | { merge?: string } {
  const parentCommits = new Set(parent ? [...parent.commits.keys(), ...parent.pastHeads] : [])
  const commits: LayerPlan['commits'] = []
  let flatten: LayerPlan['flatten']

  let oid = layer.headOid
  while (!parentCommits.has(oid)) {
    const parents = layer.commits.get(oid)
    if (!parents) {
      // A layer above the lowest open one that never meets its parent may hold parent commits that were never pushed, which can't be found.
      if (!lowest) {
        return {}
      }
      break
    }

    if (parents.length === 1) {
      commits.unshift({ oid, parent: parents[0] })
      oid = parents[0]
      continue
    }
    // `git merge <parent>` puts the parent's commit second. Such a merge only brings in what the layer is rebased onto anyway, so it is dropped.
    // Any other merge holds changes a rebase can't replay.
    if (parents.length !== 2 || !parentCommits.has(parents[1])) {
      return { merge: oid }
    }
    // The newest merge brought in the most of the parent, so the replay is checked against that one.
    flatten ??= { merge: oid, tip: parents[1] }
    oid = parents[0]
  }

  return {
    prId: layer.prId,
    ref: layer.ref,
    headOid: layer.headOid,
    baseOid: oid,
    commits,
    onParent: parentCommits.has(oid),
    ...(flatten && { flatten })
  }
}
