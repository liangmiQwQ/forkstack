import { setTimeout } from 'node:timers/promises'

import { define } from 'gunshi'
import c from 'picocolors'

import { createStack, deleteStack, listStacks } from '../api.ts'
import type { ApiError } from '../api.ts'
import { currentBranch, git } from '../git.ts'
import { createPr, findOpenPr } from '../github.ts'
import type { PrRef } from '../github.ts'
import { findLocalStack } from '../local-stack.ts'
import type { LocalBranch } from '../local-stack.ts'
import { findRemotes, REMOTE_ARGS } from '../remotes.ts'
import type { Remotes } from '../remotes.ts'
import { findTrunk } from '../trunk.ts'

// GitHub's search finds a new PR a few seconds after it opens, and the server finds stacks through the search.
const SEARCH_RETRIES = 6
const SEARCH_DELAY_MS = 5000

export const submit = define({
  name: 'submit',
  description: 'Push every branch in the stack to your fork, open their PRs and link the stack',
  args: {
    ...REMOTE_ARGS,
    draft: { type: 'boolean', description: 'Open new PRs as drafts' }
  },
  run: async ctx => {
    // 1. Find the stack from the current branch's git ancestry
    const remotes = await findRemotes(ctx.values)
    const trunk = await findTrunk(remotes, { fetch: true })
    const stack = await findLocalStack(trunk.oid, await currentBranch(), remotes.forkRemote)

    // 2. Push every branch. The lease refuses to overwrite commits pushed from elsewhere.
    const names = stack.map(branch => branch.name)
    await git('push', '--quiet', '--force-with-lease', remotes.forkRemote, ...names)
    console.log(`Pushed ${names.map(name => c.cyan(name)).join(', ')} to ${remotes.fork}`)

    // 3. Open a PR for each branch that has none. PRs that exist already got the new commits from the push.
    const prs: PrRef[] = []
    let opened = false
    for (const [index, branch] of stack.entries()) {
      const existing = await findOpenPr(remotes, branch.name)
      const pr =
        existing ??
        (await openPr(remotes, trunk.branch, branch, stack[index - 1], ctx.values.draft ?? false))
      opened ||= !existing
      prs.push(pr)
      console.log(`${existing ? 'Updated' : 'Opened'} #${pr.number} ${c.dim(pr.url)}`)
    }

    // 4. Link the stack on forkstack, which posts its comment on every PR
    if (prs.length < 2) {
      console.log('A stack needs two branches, so nothing was linked on forkstack.')
      return
    }
    await linkStack(
      prs.map(pr => pr.id),
      opened
    )
  }
})

// The PR is described by the layer's first own commit, like `git` and GitHub describe a single-commit PR.
async function openPr(
  remotes: Remotes,
  base: string,
  branch: LocalBranch,
  parent: LocalBranch | undefined,
  draft: boolean
) {
  const own = branch.commits.filter(oid => !parent?.commits.includes(oid))
  const message = await git('show', '--no-patch', '--format=%B', own.at(-1)!)
  const [title, ...body] = message.split('\n')
  return createPr(remotes, base, branch.name, { title, body: body.join('\n').trim(), draft })
}

// A PR is in at most one stack, so a stack that shares PRs with this one is replaced, such as after a branch was added on top.
async function linkStack(prIds: string[], opened: boolean) {
  const linked = (await listStacks()).find(stack => stack.prIds.some(id => prIds.includes(id)))
  if (linked?.prIds.join(',') === prIds.join(',')) {
    console.log('The stack is linked on forkstack already.')
    return
  }
  if (linked) {
    await deleteStack(linked.id)
  }

  for (let attempt = 1; ; attempt++) {
    try {
      await createStack(prIds)
      console.log(c.green('Linked the stack on forkstack.'))
      return
    } catch (error) {
      if (!opened || attempt === SEARCH_RETRIES || (error as ApiError).status !== 409) {
        throw error
      }
      await setTimeout(SEARCH_DELAY_MS)
    }
  }
}
