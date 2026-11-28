import { setTimeout } from 'node:timers/promises'

import type { PullRequest } from '@forkstack/core/discovery'
import { define } from 'gunshi'
import c from 'picocolors'

import { createStack, deleteStack, getStack, listStacks } from '../api.ts'
import type { ApiError } from '../api.ts'
import { COMMAND } from '../command.ts'
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
    draft: { type: 'boolean', description: 'Open new PRs as drafts' },
    exclude: {
      type: 'string',
      multiple: true,
      description: 'Leave a local branch out of the stack. Repeat to leave out more than one.'
    }
  },
  run: async ctx => {
    // 1. Find the stack from the current branch's git ancestry
    const remotes = await findRemotes(ctx.values)
    const trunk = await findTrunk(remotes, { fetch: true })
    const stack = await findLocalStack(trunk.oid, await currentBranch(), remotes.forkRemote, {
      exclude: ctx.values.exclude
    })
    const below = stack.length > 1 ? [] : await findRecordedStackBelow(stack[0])

    // 2. Push every branch. The lease refuses to overwrite commits pushed from elsewhere.
    const names = stack.map(branch => branch.name)
    await git('push', '--quiet', '--force-with-lease', remotes.forkRemote, ...names)
    console.log(`Pushed ${names.map(name => c.cyan(name)).join(', ')} to ${remotes.fork}`)

    // 3. Open a PR for each branch that has none. PRs that exist already got the new commits from the push.
    const prs: PrRef[] = []
    let opened = false
    for (const [index, branch] of stack.entries()) {
      const existing = await findOpenPr(remotes, branch.name)
      const parent = index > 0 ? stack[index - 1] : below.at(-1)
      const pr =
        existing ?? (await openPr(remotes, trunk.branch, branch, parent, ctx.values.draft ?? false))
      opened ||= !existing
      prs.push(pr)
      console.log(`${existing ? 'Updated' : 'Opened'} #${pr.number} ${c.dim(pr.url)}`)
    }

    // 4. Link the stack on forkstack, which posts its comment on every PR
    await linkStack(
      [...below, ...prs].map(pr => pr.id),
      opened
    )
  }
})

// A single branch is no stack, unless it adds a layer on top of a stack forkstack recorded whose lower branches aren't checked out here.
async function findRecordedStackBelow(branch: LocalBranch): Promise<PullRequest[]> {
  const stacks = await Promise.all((await listStacks()).map(summary => getStack(summary.id)))
  const below = stacks.find(stack => {
    const top = stack.prs.at(-1)!
    return top.headOid !== branch.headOid && branch.commits.includes(top.headOid)
  })
  if (!below) {
    throw new Error(
      `\`${branch.name}\` has no branch above or below it, so it is not a stack. Create the next branch on top of it, or run \`${COMMAND} checkout\` to get the rest of its stack.`
    )
  }
  return below.prs
}

// The PR is described by the layer's first own commit, like `git` and GitHub describe a single-commit PR.
async function openPr(
  remotes: Remotes,
  base: string,
  branch: LocalBranch,
  parent: Pick<LocalBranch, 'commits'> | undefined,
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
