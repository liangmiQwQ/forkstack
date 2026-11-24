import { define } from 'gunshi'

import { deleteStack } from '../api.ts'
import { findBranchStack } from '../current-stack.ts'
import { currentBranch } from '../git.ts'
import { findRemotes, REMOTE_ARGS } from '../remotes.ts'

export const unstack = define({
  name: 'unstack',
  description: 'Unlink the stack of the current branch on forkstack. Its PRs stay open.',
  args: REMOTE_ARGS,
  run: async ctx => {
    const remotes = await findRemotes(ctx.values)
    const stack = await findBranchStack(remotes, await currentBranch())

    await deleteStack(stack.id)
    const numbers = stack.prs.map(pr => `#${pr.number}`).join(', ')
    console.log(`Unlinked the stack of ${numbers}, and removed forkstack's comments.`)
  }
})
