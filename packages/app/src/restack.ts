import { planLayers, rebaseTargets } from '@forkstack/core/restack-plan'
import type { LayerPlan } from '@forkstack/core/restack-plan'
import { env } from 'void/env'

import { getGithubId } from './account.ts'
import { createGit } from './git.ts'
import type { Git, RefUpdate } from './git.ts'
import { canPush, getRepoToken } from './github-app.ts'
import { fetchRestackState } from './github.ts'
import { replayLayer } from './replay.ts'
import { findSigningKey, loadSigner } from './signing-key.ts'
import type { Signer } from './signing.ts'

export type RestackResult =
  | { state: 'done'; updated: number }
  | { state: 'conflict'; prId: string; commit: string }
  | { state: 'ambiguous'; prId: string; merge?: string }
  | { state: 'diverged'; prId: string; merge: string }
  | { state: 'unsupported' }
  | { state: 'too-large'; commits: number }
  | { state: 'not-installed'; repo: string }
  | { state: 'no-access'; repo: string }
  | { state: 'needs-signature' }
  | { state: 'unverified'; reason: string }

// Each replayed commit costs about five GitHub requests, and a Worker invocation can only make so many.
const MAX_COMMITS = 100

async function inspectRestack(prIds: string[]) {
  const state = await fetchRestackState(env.GITHUB_BOT_TOKEN, prIds)
  if (!state) {
    return { state: 'unsupported' } as const
  }
  const plans = planLayers(state.layers, state.merged)
  if ('ambiguous' in plans) {
    return {
      state: 'ambiguous',
      prId: state.layers[plans.ambiguous].prId,
      merge: plans.merge
    } as const
  }
  return {
    state: 'ready',
    stack: state,
    plans,
    targets: rebaseTargets(plans, state.mainOid)
  } as const
}

export type RebaseOptions = Awaited<ReturnType<typeof readRebaseOptions>>

export async function readRebaseOptions(prIds: string[]) {
  const plan = await inspectRestack(prIds)
  if (plan.state === 'ready') {
    return { ...plan.targets, needsSignature: plan.stack.needsSignature, problem: null }
  }
  const problem =
    plan.state === 'ambiguous'
      ? `The commits belonging to each layer could not be determined${plan.merge ? `, because of merge ${plan.merge.slice(0, 7)}` : ''}. Rebase locally.`
      : 'This stack cannot be rebased automatically. Check the pull requests on GitHub.'
  return { onMain: false, layersOnly: false, needsSignature: false, problem }
}

// Kept apart from `readRebaseOptions`, whose result is cached, so a key the author just added counts right away.
export async function checkSigningKey(
  options: RebaseOptions,
  ownerId: string
): Promise<RebaseOptions> {
  if (!options.needsSignature || options.problem || (await findSigningKey(ownerId))) {
    return options
  }
  return {
    ...options,
    onMain: false,
    layersOnly: false,
    problem:
      'This stack has verified commits, or its base branch requires signed commits, and a web rebase would leave the new commits unsigned. The author can add a signing key in Settings, or rebase locally with forkstack rebase.'
  }
}

// Read GitHub again when the queued job runs; a branch can move after the request.
// The stack owner's key signs, even when a maintainer or a merge started the rebase, so the new commits stay the author's.
export async function restack(
  prIds: string[],
  onMain: boolean,
  ownerId: string
): Promise<RestackResult> {
  const plan = await inspectRestack(prIds)
  if (plan.state !== 'ready') {
    return plan
  }
  const { stack: state, plans, targets } = plan
  if (!(onMain ? targets.onMain : targets.layersOnly)) {
    return { state: 'done', updated: 0 }
  }

  // A layer that merged its parent is replayed twice, once to check it and once onto its new parent.
  const commits = plans.reduce((sum, plan) => sum + plan.commits.length * (plan.flatten ? 2 : 1), 0)
  if (commits > MAX_COMMITS) {
    return { state: 'too-large', commits }
  }

  const signer = await loadSigner(ownerId)
  if (!signer && state.needsSignature) {
    return { state: 'needs-signature' }
  }

  // 2. Replay the commits in the fork, on a scratch branch the merge API can work on
  const token = await getRepoToken(state.repo)
  if (!token) {
    return { state: 'not-installed', repo: state.repo }
  }
  // Checked when the job runs, since the owner may have lost access after saving the stack.
  const githubId = await getGithubId(ownerId)
  if (!githubId || !(await canPush(token, state.repo, githubId))) {
    return { state: 'no-access', repo: state.repo }
  }

  const git = createGit(token, state.repo)
  // A layer leaving its merged parent goes onto the base branch, which already holds the parent's commits.
  const onto = onMain || plans[0].onParent ? state.mainOid : plans[0].baseOid
  const result = await withScratchBranch(git, plans[0].headOid, scratch =>
    replayLayers(git, scratch, onto, plans, signer)
  )

  // 3. Move the branches. Layers below a conflict are still rebased, since they don't depend on it.
  if (result.updates.length > 0) {
    await git.updateBranches(state.repositoryId, result.updates)
  }

  return result.stopped ?? { state: 'done', updated: result.updates.length }
}

async function withScratchBranch<T>(git: Git, oid: string, run: (scratch: string) => Promise<T>) {
  const scratch = `forkstack/restack-${crypto.randomUUID()}`
  await git.createBranch(scratch, oid)
  try {
    return await run(scratch)
  } finally {
    await git.deleteBranch(scratch)
  }
}

async function replayLayers(
  git: Git,
  scratch: string,
  onto: string,
  plans: LayerPlan[],
  signer: Signer | null
): Promise<{ updates: RefUpdate[]; stopped: RestackResult | null }> {
  const updates: RefUpdate[] = []

  let base = onto
  for (const plan of plans) {
    const replayed = await (plan.flatten
      ? flattenLayer(git, scratch, base, plan, plan.flatten, signer)
      : replayLayer(git, scratch, base, plan, signer))
    if ('conflict' in replayed) {
      return { updates, stopped: { state: 'conflict', prId: plan.prId, commit: replayed.conflict } }
    }
    // Every new commit is signed with the same key, so no branch moves once GitHub rejects one of them.
    if ('unverified' in replayed) {
      return { updates: [], stopped: { state: 'unverified', reason: replayed.unverified } }
    }
    if ('diverged' in replayed) {
      return { updates, stopped: { state: 'diverged', prId: plan.prId, merge: replayed.diverged } }
    }

    if (replayed.head !== plan.headOid) {
      updates.push({ ref: plan.ref, beforeOid: plan.headOid, afterOid: replayed.head })
    }
    base = replayed.head
  }

  return { updates, stopped: null }
}

// Dropping the parent merge must not drop edits recorded only in it, such as a conflict resolution.
// So the layer is first replayed onto the parent commit it merged, which has to give back the same tree, and only then onto its new parent.
async function flattenLayer(
  git: Git,
  scratch: string,
  onto: string,
  plan: LayerPlan,
  { merge, tip }: NonNullable<LayerPlan['flatten']>,
  signer: Signer | null
) {
  const checked = await replayLayer(git, scratch, tip, plan, signer)
  if (!('head' in checked)) {
    return checked
  }

  const [flat, original] = await Promise.all([
    git.getCommit(checked.head),
    git.getCommit(plan.headOid)
  ])
  if (flat.tree !== original.tree) {
    return { diverged: merge }
  }
  return onto === tip ? checked : replayLayer(git, scratch, onto, plan, signer)
}
