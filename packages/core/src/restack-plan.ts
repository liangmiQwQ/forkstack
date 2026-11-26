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
  /** The layer's own commits, bottom to top. */
  commits: string[]
  /** Whether those commits sit on the parent's, rather than on the base branch. */
  onParent: boolean
}

// Nothing about a stack is stored between restacks, since users force-push, squash and restack by hand outside forkstack.
// Each layer's own commits are found again from what GitHub knows now: the commits above the newest parent commit in its branch.
// The first `merged` layers were merged already. They aren't planned, but still mark where the lowest open layer's commits start.
// Returns the index of the first layer whose commits can't be told apart from its parent's, so the user restacks it by hand.
export function planLayers(
  layers: LayerState[],
  merged: number
): LayerPlan[] | { ambiguous: number } {
  const plans: LayerPlan[] = []

  for (const [index, layer] of layers.entries()) {
    if (index < merged) {
      continue
    }

    const plan = planLayer(layer, layers[index - 1], index === merged)
    if (!plan) {
      return { ambiguous: index }
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
  return {
    onMain: baseMoved || layerMoved,
    layersOnly: layerMoved || (baseMoved && plans[0].onParent)
  }
}

// Walks down from the head until it reaches a commit the parent had at some point.
// The lowest open layer may stop at the base branch instead, which is where its PR's commits end.
// That happens when the user rebased it onto the base branch by hand after its parent merged.
function planLayer(
  layer: LayerState,
  parent: LayerState | undefined,
  lowest: boolean
): LayerPlan | null {
  const parentCommits = new Set(parent ? [...parent.commits.keys(), ...parent.pastHeads] : [])
  const commits: string[] = []

  let oid = layer.headOid
  while (!parentCommits.has(oid)) {
    const parents = layer.commits.get(oid)
    if (!parents) {
      // A layer above the lowest open one that never meets its parent may hold parent commits that were never pushed, which can't be found.
      if (!lowest) {
        return null
      }
      break
    }
    // Replaying a merge commit would need a merge strategy, which a rebase doesn't have.
    if (parents.length !== 1) {
      return null
    }

    commits.unshift(oid)
    oid = parents[0]
  }

  return {
    prId: layer.prId,
    ref: layer.ref,
    headOid: layer.headOid,
    baseOid: oid,
    commits,
    onParent: parentCommits.has(oid)
  }
}
