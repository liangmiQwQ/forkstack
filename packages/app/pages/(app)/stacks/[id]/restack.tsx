import { Form, Link, useForm, useRouter } from '@void/react'
import { useEffect } from 'react'
import type { ReactNode } from 'react'

import { PendingIcon, PrList, PrRow, StackRepo } from '../../../../src/components/stack.tsx'
import type { PullRequest } from '../../../../src/discovery.ts'
import type { RestackStatus } from '../../../../src/restack-job.ts'
import type { Props } from './restack.server.ts'

// A restack takes seconds to a minute, so the page checks back on this interval while one runs.
const POLL_MS = 3000

export default function RestackPage({ stackId, prs, status, running, installUrl }: Props) {
  usePolling(running)

  return (
    <div className='flex flex-col gap-6'>
      <header className='flex flex-col gap-3'>
        <Link href='/dashboard' className='nav-link -ml-2.5 self-start'>
          <span className='i-lucide-arrow-left' />
          Dashboard
        </Link>
        <h1 className='text-2xl font-semibold'>Rebase stack</h1>
        <p className='max-w-2xl text-sm text-neutral-500'>
          forkstack replays each pull request’s own commits onto the new head of the one below it,
          then force-pushes every branch that changed at once. Checks run again on those pull
          requests.
        </p>
      </header>

      {status && <StatusNotice status={status} prs={prs} installUrl={installUrl} />}

      <article className='card overflow-hidden'>
        <header className='card-header'>{prs[0] && <StackRepo pr={prs[0]} />}</header>
        <div className='p-2'>
          <PrList baseRef={prs[0]?.baseRef ?? ''}>
            {prs.toReversed().map(pr => (
              <PrRow key={pr.id} pr={pr} faded={running} />
            ))}
          </PrList>
        </div>
      </article>

      <div className='flex flex-wrap gap-3'>
        <RestackButton
          stackId={stackId}
          onMain
          disabled={running}
          icon='i-lucide-git-pull-request-arrow'
          label={`Rebase onto ${prs[0]?.baseRef ?? 'base'}`}
          solid
        />
        <RestackButton
          stackId={stackId}
          onMain={false}
          disabled={running}
          icon='i-lucide-layers'
          label='Restack layers only'
        />
      </div>
    </div>
  )
}

function RestackButton({
  stackId,
  onMain,
  disabled,
  icon,
  label,
  solid = false
}: {
  stackId: string
  onMain: boolean
  disabled: boolean
  icon: string
  label: string
  solid?: boolean
}) {
  const form = useForm(
    '/stacks/[id]/restack?restack',
    { onMain },
    { params: { id: stackId }, throwOnError: false }
  )

  return (
    <Form form={form} className='form-alert flex flex-col gap-2'>
      <button
        type='submit'
        className={solid ? 'btn-solid' : 'btn-outline'}
        disabled={disabled || form.pending}
      >
        <PendingIcon pending={form.pending} icon={icon} />
        {label}
      </button>
    </Form>
  )
}

function usePolling(active: boolean) {
  const router = useRouter()

  useEffect(() => {
    const timer = active
      ? setInterval(() => {
          void router.refresh()
        }, POLL_MS)
      : undefined
    return () => clearInterval(timer)
  }, [active, router])
}

// Every outcome says what happened on GitHub and what the user can do next.
function StatusNotice({
  status,
  prs,
  installUrl
}: {
  status: RestackStatus
  prs: PullRequest[]
  installUrl: string
}) {
  const number = (prId: string) => prs.find(pr => pr.id === prId)?.number

  switch (status.state) {
    case 'running': {
      return <Notice icon='i-lucide-loader-circle animate-spin'>Rebasing the stack…</Notice>
    }
    case 'done': {
      return (
        <Notice icon='i-lucide-circle-check'>
          {status.updated === 0
            ? 'The stack was already up to date. Nothing was pushed.'
            : `Rebased and force-pushed ${status.updated} ${status.updated === 1 ? 'branch' : 'branches'}.`}
        </Notice>
      )
    }
    case 'conflict': {
      return (
        <Notice icon='i-lucide-git-merge-conflict'>
          Commit <code className='font-mono'>{status.commit.slice(0, 7)}</code> in #
          {number(status.prId)} conflicts with the commits below it. The pull requests below #
          {number(status.prId)} were rebased; it and the ones above were left as they were. Rebase
          it locally, push, then restack again.
        </Notice>
      )
    }
    case 'ambiguous': {
      return (
        <Notice icon='i-lucide-circle-help'>
          forkstack can’t tell which commits in #{number(status.prId)} belong to the pull request
          below it, such as when its branch was built on commits never pushed to that pull request,
          or contains a merge commit. Rebase it locally, push, then restack again.
        </Notice>
      )
    }
    case 'unsupported': {
      return (
        <Notice icon='i-lucide-circle-alert'>
          A pull request in this stack is no longer open, or has more than 250 commits. forkstack
          can’t rebase this stack yet.
        </Notice>
      )
    }
    case 'too-large': {
      return (
        <Notice icon='i-lucide-circle-alert'>
          This stack has {status.commits} commits to replay, more than forkstack rebases at once.
          Rebase it locally instead.
        </Notice>
      )
    }
    case 'not-installed': {
      return (
        <Notice icon='i-lucide-plug'>
          forkstack needs its GitHub App on <span className='font-mono'>{status.repo}</span> to push
          the rebased branches.{' '}
          <a href={installUrl} target='_blank' rel='noreferrer' className='underline'>
            Install it
          </a>
          , then try again.
        </Notice>
      )
    }
    // `failed`, the only state left.
    default: {
      return (
        <Notice icon='i-lucide-circle-x'>
          The rebase stopped on an unexpected error. No branch was changed unless GitHub shows a new
          push. Try again in a moment.
        </Notice>
      )
    }
  }
}

function Notice({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <p className='card flex items-start gap-3 px-4 py-3 text-sm'>
      <span className={`${icon} mt-0.5 shrink-0 text-neutral-500`} />
      <span>{children}</span>
    </p>
  )
}
