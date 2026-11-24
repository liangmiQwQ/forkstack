import { planLayers } from '@forkstack/core/restack-plan'
import type { LayerPlan } from '@forkstack/core/restack-plan'
import { env } from 'void/env'

import { createGit } from './git.ts'
import type { Git, RefUpdate } from './git.ts'
import { getRepoToken } from './github-app.ts'
import { fetchRestackState } from './github.ts'
import { replayLayer } from './replay.ts'

export type RestackResult =
  | { state: 'done'; updated: number; merged: string[] }
  | { state: 'conflict'; prId: string; commit: string }
  | { state: 'ambiguous'; prId: string }
  | { state: 'unsupported' }
  | { state: 'too-large'; commits: number }
  | { state: 'not-installed'; repo: string }

// Each replayed commit costs about five GitHub requests, and a Worker invocation can only make so many.
const MAX_COMMITS = 100

// Rebases every layer onto the new head of the layer below it. With `onMain`, the bottom layer also moves onto the latest base branch.
// Layers merged at the bottom are left out, and the lowest open layer always moves onto the latest base branch, which holds the merged changes.
export async function restack(prIds: string[], onMain: boolean): Promise<RestackResult> {
  // 1. Read the stack from GitHub and find each layer's own commits
  const state = await fetchRestackState(env.GITHUB_BOT_TOKEN, prIds)
  if (!state) {
    return { state: 'unsupported' }
  }

  const merged = state.layers.slice(0, state.merged).map(layer => layer.prId)
  const plans = planLayers(state.layers, state.merged)
  if ('ambiguous' in plans) {
    return { state: 'ambiguous', prId: state.layers[plans.ambiguous].prId }
  }
  if (plans.length === 0) {
    return { state: 'done', updated: 0, merged }
  }

  const commits = plans.reduce((sum, plan) => sum + plan.commits.length, 0)
  if (commits > MAX_COMMITS) {
    return { state: 'too-large', commits }
  }

  // 2. Replay the commits in the fork, on a scratch branch the merge API can work on
  const token = await getRepoToken(state.repo)
  if (!token) {
    return { state: 'not-installed', repo: state.repo }
  }

  const git = createGit(token, state.repo)
  const onto = onMain || merged.length > 0 ? state.mainOid : plans[0].baseOid
  const result = await withScratchBranch(git, plans[0].headOid, scratch =>
    replayLayers(git, scratch, onto, plans)
  )

  // 3. Move the branches. Layers below a conflict are still rebased, since they don't depend on it.
  if (result.updates.length > 0) {
    await git.updateBranches(state.repositoryId, result.updates)
  }

  return result.conflict
    ? { state: 'conflict', ...result.conflict }
    : { state: 'done', updated: result.updates.length, merged }
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

async function replayLayers(git: Git, scratch: string, onto: string, plans: LayerPlan[]) {
  const updates: RefUpdate[] = []

  let base = onto
  for (const plan of plans) {
    const replayed = await replayLayer(git, scratch, base, plan)
    if ('conflict' in replayed) {
      return { updates, conflict: { prId: plan.prId, commit: replayed.conflict } }
    }

    if (replayed.head !== plan.headOid) {
      updates.push({ ref: plan.ref, beforeOid: plan.headOid, afterOid: replayed.head })
    }
    base = replayed.head
  }

  return { updates, conflict: null }
}
