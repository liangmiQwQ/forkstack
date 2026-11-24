import { isCancel, select } from '@clack/prompts'
import { define } from 'gunshi'
import c from 'picocolors'

import { currentBranch, git } from '../git.ts'
import { findLocalStack } from '../local-stack.ts'
import type { LocalBranch } from '../local-stack.ts'
import { findRemotes, REMOTE_ARGS } from '../remotes.ts'
import { checkoutTrunk, findTrunk } from '../trunk.ts'

// Picks the index of the branch to move to, from the current one's index in the stack.
type Move = (index: number, length: number) => number

export const up = defineMove('up', 'Check out the branch above the current one', index => index + 1)
export const down = defineMove(
  'down',
  'Check out the branch below the current one',
  index => index - 1
)
export const top = defineMove(
  'top',
  'Check out the top branch of the stack',
  (_, length) => length - 1
)
export const bottom = defineMove('bottom', 'Check out the bottom branch of the stack', () => 0)

export const trunk = define({
  name: 'trunk',
  description: 'Check out the branch the stack merges into',
  args: REMOTE_ARGS,
  run: async ctx => {
    const remotes = await findRemotes(ctx.values)
    const { branch } = await findTrunk(remotes, { fetch: false })
    await checkoutTrunk(remotes, branch)
    console.log(`Switched to ${c.cyan(branch)}`)
  }
})

export const switchBranch = define({
  name: 'switch',
  description: 'Pick a branch of the stack to check out',
  args: REMOTE_ARGS,
  run: async ctx => {
    const { stack, index } = await readStack(ctx.values)
    const picked = await select({
      message: 'Check out a branch, top to bottom',
      initialValue: index,
      options: stack.map((branch, i) => ({ value: i, label: branch.name })).toReversed()
    })
    if (!isCancel(picked)) {
      await checkout(stack, picked)
    }
  }
})

function defineMove(name: string, description: string, move: Move) {
  return define({
    name,
    description,
    args: REMOTE_ARGS,
    run: async ctx => {
      const { stack, index } = await readStack(ctx.values)
      const target = move(index, stack.length)
      if (target < 0 || target >= stack.length) {
        throw new Error(
          `\`${stack[index].name}\` is the ${target < 0 ? 'bottom' : 'top'} of its stack already.`
        )
      }
      await checkout(stack, target)
    }
  })
}

// Moving around doesn't need the latest trunk, so it works offline.
async function readStack(options: { fork: string; upstream?: string }) {
  const remotes = await findRemotes(options)
  const { oid } = await findTrunk(remotes, { fetch: false })
  const branch = await currentBranch()

  const stack = await findLocalStack(oid, branch, remotes.forkRemote)
  return { stack, index: stack.findIndex(layer => layer.name === branch) }
}

async function checkout(stack: LocalBranch[], index: number) {
  await git('checkout', '--quiet', stack[index].name)
  console.log(`Switched to ${c.cyan(stack[index].name)} (${index + 1} of ${stack.length})`)
}
