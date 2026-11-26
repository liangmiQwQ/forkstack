import type { PullRequest } from '@forkstack/core/discovery'
import { Form, Link, useForm, useRouter } from '@void/react'
import { Suspense, use, useEffect, useEffectEvent, useState } from 'react'
import type { ReactNode } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { connectLiveStream } from 'void/live/client'

import {
  LoadError,
  PendingIcon,
  PrList,
  PrListSkeleton,
  PrRow,
  Skeleton,
  StackRepo
} from '../../../../src/components/stack.tsx'
import { RESTACK_TIMEOUT_MS } from '../../../../src/restack-status.ts'
import type { RestackStatus } from '../../../../src/restack-status.ts'
import type { Props } from './restack.server.ts'

type GitHubData = Awaited<Props['github']>
type ViewProps = Omit<Props, 'github' | 'expiredAt'> & { running: boolean }

export default function RestackPage(props: Props) {
  return <StackRebase key={props.stackId} {...props} />
}

// The live status sits above the Suspense boundary, so its stream stays open while GitHub loads.
// A refresh brings a new `github` promise, which resets the error boundary.
function StackRebase({ github, status: saved, expiredAt, ...props }: Props) {
  const { status, running } = useRestackStatus(props.stackId, saved, expiredAt, props.prCount)
  const view = { ...props, status, running }

  return (
    // oxlint-disable-next-line react-perf/jsx-no-jsx-as-prop, react-perf/jsx-no-new-array-as-prop -- ErrorBoundary takes these as props, and the React Compiler memoizes them.
    <ErrorBoundary resetKeys={[github]} fallback={<RebaseError stackId={props.stackId} />}>
      {/* oxlint-disable-next-line react-perf/jsx-no-jsx-as-prop -- Suspense takes its fallback as a prop, and the React Compiler memoizes it. */}
      <Suspense fallback={<RebaseView {...view} />}>
        <LoadedRebaseView {...view} github={github} />
      </Suspense>
    </ErrorBoundary>
  )
}

function LoadedRebaseView({ github, ...props }: ViewProps & Pick<Props, 'github'>) {
  return <RebaseView {...props} github={use(github)} />
}

// The database rows render right away, and the buttons stay disabled until `github` brings the rebase options.
function RebaseView({
  stackId,
  repo,
  prCount,
  status,
  running,
  installUrl,
  github
}: ViewProps & { github?: GitHubData }) {
  const prs = github?.prs
  const options = github?.options
  // Stacks saved before forkstack stored their repository take it from GitHub.
  const shownRepo = repo ?? prs?.[0]

  return (
    <div className='flex flex-col gap-6'>
      <RebaseHeader stackId={stackId} />

      {options?.problem && <Notice icon='i-lucide-circle-alert'>{options.problem}</Notice>}
      {options && !options.problem && !options.onMain && (
        <Notice icon='i-lucide-circle-check'>This stack is up to date.</Notice>
      )}
      {status && (running || (options?.onMain && !options.problem)) && (
        <StatusNotice status={status} running={running} prs={prs} installUrl={installUrl} />
      )}

      <article className='card overflow-hidden'>
        <header className='card-header'>
          {shownRepo ? (
            <StackRepo repo={shownRepo} />
          ) : (
            !github && <Skeleton className='h-5 w-72 max-w-full' />
          )}
        </header>
        <div className='p-2'>
          {prs ? (
            <PrList baseRef={prs[0]?.baseRef ?? ''}>
              {prs.toReversed().map(pr => (
                <PrRow key={pr.id} pr={pr} />
              ))}
            </PrList>
          ) : (
            <PrListSkeleton size={prCount} />
          )}
        </div>
      </article>

      <div className='flex flex-wrap gap-3'>
        <RestackButton
          stackId={stackId}
          onMain
          disabled={running || !options?.onMain}
          icon='i-lucide-git-pull-request-arrow'
          label={`Rebase onto ${prs?.[0]?.baseRef ?? 'base'}`}
          solid
        />
        <RestackButton
          stackId={stackId}
          onMain={false}
          disabled={running || !options?.layersOnly}
          icon='i-lucide-layers'
          label={
            options?.onMain && !options.layersOnly ? 'Layers up to date' : 'Restack layers only'
          }
        />
      </div>
    </div>
  )
}

function RebaseError({ stackId }: Pick<Props, 'stackId'>) {
  return (
    <div className='flex flex-col gap-6'>
      <RebaseHeader stackId={stackId} />
      <LoadError />
    </div>
  )
}

function RebaseHeader({ stackId }: Pick<Props, 'stackId'>) {
  return (
    <header className='flex flex-col gap-3'>
      <Link href={`/stacks/${stackId}`} className='nav-link -ml-2.5 self-start'>
        <span className='i-lucide-arrow-left' />
        Stack
      </Link>
      <h1 className='text-2xl font-semibold'>Rebase stack</h1>
      <p className='max-w-2xl text-sm text-neutral-500'>
        forkstack replays each pull request&apos;s own commits onto the new head of the one below
        it, then force-pushes every branch that changed at once. Checks run again on those pull
        requests.
      </p>
    </header>
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

function useRestackStatus(
  stackId: string,
  saved: RestackStatus | null,
  expiredAt: string | null,
  prCount: number
) {
  const router = useRouter()
  const [latest, setLatest] = useState<RestackStatus | null>(null)
  const [timedOut, setTimedOut] = useState(expiredAt)
  const status = latest && (!saved || latest.at >= saved.at) ? latest : saved

  const receive = useEffectEvent((data: RestackStatus) => {
    setLatest(previous => (previous && previous.at >= data.at ? previous : data))
    if (
      data.state !== 'running' &&
      (!status || data.at > status.at) &&
      (data.state !== 'done' || prCount - data.merged.length >= 2)
    ) {
      void router.refresh()
    }
  })

  useEffect(() => {
    const stream = connectLiveStream(
      new URL(`/stacks/${encodeURIComponent(stackId)}/live`, globalThis.location.origin)
    )
    let closed = false
    let retry: ReturnType<typeof setTimeout>
    async function subscribe() {
      try {
        await stream.subscribe<RestackStatus>({
          id: 'restack',
          topic: stackId,
          onEvent: ({ data }) => receive(data)
        })
      } catch {
        // Void reconnects established streams. Retry an initial connection that failed to open.
        if (!closed) {
          retry = setTimeout(() => void subscribe(), 3000)
        }
      }
    }
    void subscribe()
    return () => {
      closed = true
      clearTimeout(retry)
      stream.close()
    }
  }, [stackId])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    if (status?.state === 'running' && status.at !== expiredAt && status.at !== timedOut) {
      // Recheck the saved result once if the worker never reported back to this tab.
      const remaining = Date.parse(status.at) + RESTACK_TIMEOUT_MS - Date.now()
      timer = setTimeout(
        () => {
          setTimedOut(status.at)
          void router.refresh()
        },
        Math.max(remaining, 0)
      )
    }
    return () => clearTimeout(timer)
  }, [router, status?.state, status?.at, expiredAt, timedOut])

  return {
    status,
    running: status?.state === 'running' && status.at !== timedOut && status.at !== expiredAt
  }
}

// Every outcome says what happened on GitHub and what the user can do next.
function StatusNotice({
  status,
  running,
  prs,
  installUrl
}: {
  status: RestackStatus
  running: boolean
  /** Missing while GitHub loads, when only a running rebase shows. */
  prs?: PullRequest[]
  installUrl: string
}) {
  const number = (prId: string) => prs?.find(pr => pr.id === prId)?.number

  switch (status.state) {
    case 'running': {
      if (!running) {
        return (
          <Notice icon='i-lucide-clock'>No result received. You can try the rebase again.</Notice>
        )
      }
      return (
        <Notice icon='i-lucide-server'>
          forkstack handles this rebase on the server. You can close this tab and come back here for
          the result.
        </Notice>
      )
    }
    case 'done': {
      return (
        <Notice icon='i-lucide-circle-check'>
          {status.updated === 0
            ? 'The last rebase did not need to push any branches.'
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
          forkstack can&apos;t tell which commits in #{number(status.prId)} belong to the pull
          request below it, such as when its branch was built on commits never pushed to that pull
          request, or contains a merge commit. Rebase it locally, push, then restack again.
        </Notice>
      )
    }
    case 'unsupported': {
      return (
        <Notice icon='i-lucide-circle-alert'>
          This stack is broken, since a pull request was closed or merged out of order, or one has
          more than 250 commits. Rebase it locally, then create the stack again.
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
