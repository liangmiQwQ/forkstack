import { planLayers } from '@forkstack/core/restack-plan'
import { countMerged } from '@forkstack/core/stack-health'
import { define } from 'gunshi'
import c from 'picocolors'

import { execInteractive } from '../exec.ts'
import { currentBranch, git } from '../git.ts'
import { findPrState } from '../github.ts'
import { readLayerState } from '../layers.ts'
import { findLocalStack } from '../local-stack.ts'
import {
  clearRebaseState,
  isGitRebasing,
  readRebaseState,
  saveRebaseState
} from '../rebase-state.ts'
import type { RebaseState } from '../rebase-state.ts'
import { findRemotes, REMOTE_ARGS } from '../remotes.ts'
import { findTrunk } from '../trunk.ts'

export const rebase = define({
  name: 'rebase',
  description: 'Rebase the stack onto the latest trunk locally, then force-push it',
  args: {
    ...REMOTE_ARGS,
    continue: { type: 'boolean', description: 'Continue after resolving a conflict' },
    abort: { type: 'boolean', description: 'Undo the rebase and restore every branch' }
  },
  run: async ctx => {
    const state = await readRebaseState()
    if (ctx.values.continue || ctx.values.abort) {
      if (!state) {
        throw new Error('No forkstack rebase is in progress.')
      }
      await (ctx.values.abort ? abort(state) : resume(state))
      return
    }
    if (state) {
      throw new Error(
        'A forkstack rebase is in progress. Run `forkstack rebase --continue` or `--abort`.'
      )
    }

    await start(ctx.values)
  }
})

// Rebases each layer onto the new head of the one below it, and the lowest open layer onto the latest trunk.
async function start(options: { fork: string; upstream?: string }) {
  // 1. Read the stack and find each layer's own commits, the same way the server does
  const remotes = await findRemotes(options)
  const trunk = await findTrunk(remotes, { fetch: true })
  const branch = await currentBranch()
  if (await git('status', '--porcelain', '--untracked-files=no')) {
    throw new Error('Commit or stash your changes first.')
  }

  const stack = await findLocalStack(trunk.oid, branch)
  const merged = countMerged(
    await Promise.all(stack.map(layer => findPrState(remotes, layer.name)))
  )
  if (merged === null) {
    throw new Error(
      'The stack is broken: a PR was closed, or merged above an open one. Rebase it by hand.'
    )
  }

  const layers = await Promise.all(
    stack.map(layer => readLayerState(layer, trunk.oid, remotes.forkRemote))
  )
  const plans = planLayers(layers, merged)
  if ('ambiguous' in plans) {
    throw new Error(
      `Can't tell \`${stack[plans.ambiguous].name}\`'s own commits from its parent's. Rebase it by hand.`
    )
  }

  // 2. Replay the layers. The state is saved first, so a conflict can be continued or undone.
  await replay({
    branch,
    forkRemote: remotes.forkRemote,
    originals: stack.map(layer => ({ ref: layer.name, oid: layer.headOid })),
    pending: plans.map(plan => ({ ref: plan.ref, baseOid: plan.baseOid })),
    onto: trunk.oid
  })

  for (const layer of stack.slice(0, merged)) {
    console.log(`${c.cyan(layer.name)} was merged, and can be deleted.`)
  }
}

// The user may have finished git's rebase by hand already, so `git rebase --continue` only runs while one is open.
async function resume(state: RebaseState) {
  if (
    (await isGitRebasing()) &&
    !(await execInteractive('git', ['rebase', '--continue'], { GIT_EDITOR: 'true' }))
  ) {
    stopAtConflict(state)
    return
  }

  const [layer, ...rest] = state.pending
  await replay({ ...state, pending: rest, onto: await git('rev-parse', layer.ref) })
}

// Rebases the first pending layer, then the rest on top of it.
async function replay(state: RebaseState): Promise<void> {
  const [layer, ...rest] = state.pending
  if (state.pending.length === 0) {
    await finish(state)
    return
  }

  await saveRebaseState(state)
  // A layer that sits on its target already keeps its commits, so it isn't pushed again.
  if (layer.baseOid !== state.onto) {
    const args = ['rebase', '--onto', state.onto, layer.baseOid, layer.ref]
    if (!(await execInteractive('git', args))) {
      stopAtConflict(state)
      return
    }
  }

  await replay({ ...state, pending: rest, onto: await git('rev-parse', layer.ref) })
}

async function finish(state: RebaseState) {
  const changed: string[] = []
  for (const original of state.originals) {
    if ((await git('rev-parse', original.ref)) !== original.oid) {
      changed.push(original.ref)
    }
  }

  await git('checkout', '--quiet', state.branch)
  await clearRebaseState()
  if (changed.length === 0) {
    console.log('The stack is up to date already.')
    return
  }

  // The lease refuses to overwrite commits pushed from elsewhere since the last fetch.
  await git('push', '--quiet', '--force-with-lease', state.forkRemote, ...changed)
  console.log(c.green(`Rebased and pushed ${changed.map(ref => c.cyan(ref)).join(', ')}.`))
}

// Branches can't move while one of them is checked out, so HEAD is detached until they are restored.
async function abort(state: RebaseState) {
  if (await isGitRebasing()) {
    await git('rebase', '--abort')
  }

  await git('checkout', '--quiet', '--detach')
  for (const original of state.originals) {
    await git('update-ref', `refs/heads/${original.ref}`, original.oid)
  }
  await git('checkout', '--quiet', state.branch)
  await clearRebaseState()
  console.log('Restored every branch of the stack.')
}

function stopAtConflict(state: RebaseState) {
  console.error(
    c.red(
      `\nResolve the conflicts in \`${state.pending[0].ref}\` and \`git add\` them, then run \`forkstack rebase --continue\`. Run \`forkstack rebase --abort\` to undo.`
    )
  )
  process.exitCode = 1
}
