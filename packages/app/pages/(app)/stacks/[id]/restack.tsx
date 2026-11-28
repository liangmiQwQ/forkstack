import type { PullRequest } from '@forkstack/core/discovery'
import { Form, Link, useForm, useRouter } from '@void/react'
import { Suspense, use, useEffect, useEffectEvent, useState } from 'react'
import type { ReactNode } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { connectLiveStream } from 'void/live/client'

import { ReauthorizeButton } from '../../../../src/components/reauthorize.tsx'
import {
  LoadError,
  PendingIcon,
  PrList,
  PrListSkeleton,
  PrRow,
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
  const { status, running } = useRestackStatus(props.stackId, saved, expiredAt)
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
  isAuthor,
  needsReauthorize,
  github
}: ViewProps & { github?: GitHubData }) {
  const prs = github?.prs
  const options = github?.options

  return (
    <div className='flex flex-col gap-6'>
      <RebaseHeader stackId={stackId} />

      {needsReauthorize && (
        <Notice icon='i-lucide-key-round'>
          <span className='flex flex-col gap-3'>
            forkstack needs permission to push rebases that update workflow files. Reauthorize it
            with GitHub, or a rebase onto a base that changed them fails.
            <ReauthorizeButton callbackURL={`/stacks/${stackId}/restack`} />
          </span>
        </Notice>
      )}
      {options?.problem && <Notice icon='i-lucide-circle-alert'>{options.problem}</Notice>}
      {options && !options.problem && !options.onMain && (
        <Notice icon='i-lucide-circle-check'>This stack is up to date.</Notice>
      )}
      {status && (running || (options?.onMain && !options.problem)) && (
        <StatusNotice
          stackId={stackId}
          status={status}
          running={running}
          prs={prs}
          isAuthor={isAuthor}
        />
      )}

      <article className='card overflow-hidden'>
        <header className='card-header'>
          <StackRepo repo={repo} />
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
        it, then force-pushes every branch that changed at once. When the author has a signing key,
        the new commits are signed with it. Checks run again on those pull requests.
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

function useRestackStatus(stackId: string, saved: RestackStatus | null, expiredAt: string | null) {
  const router = useRouter()
  const [latest, setLatest] = useState<RestackStatus | null>(null)
  const [timedOut, setTimedOut] = useState(expiredAt)
  const status = latest && (!saved || latest.at >= saved.at) ? latest : saved

  const receive = useEffectEvent((data: RestackStatus) => {
    setLatest(previous => (previous && previous.at >= data.at ? previous : data))
    if (data.state !== 'running' && (!status || data.at > status.at)) {
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
  stackId,
  status,
  running,
  prs,
  isAuthor
}: {
  stackId: string
  status: RestackStatus
  running: boolean
  /** Missing while GitHub loads, when only a running rebase shows. */
  prs?: PullRequest[]
  isAuthor: boolean
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
          request
          {status.merge ? (
            <>
              , or merged <code className='font-mono'>{status.merge.slice(0, 7)}</code> from
              something other than that pull request
            </>
          ) : null}
          . Rebase it locally, push, then restack again.
        </Notice>
      )
    }
    case 'diverged': {
      return (
        <Notice icon='i-lucide-git-merge'>
          Merge <code className='font-mono'>{status.merge.slice(0, 7)}</code> in #
          {number(status.prId)} holds edits of its own, which flattening #{number(status.prId)}{' '}
          would drop. It and the pull requests above were left as they were. Rebase it locally,
          push, then restack again.
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
    case 'signed-out': {
      return (
        <Notice icon='i-lucide-plug'>
          forkstack pushes rebased branches as the author, and GitHub no longer accepts the
          author&apos;s sign-in, so no branch was changed.{' '}
          {isAuthor ? (
            <span className='mt-3 flex flex-col gap-3'>
              Sign in with GitHub again, then try again.
              <ReauthorizeButton callbackURL={`/stacks/${stackId}/restack`} />
            </span>
          ) : (
            'Ask the author to sign in to forkstack again.'
          )}
        </Notice>
      )
    }
    case 'no-access': {
      return (
        <Notice icon='i-lucide-lock'>
          The author can no longer push to <span className='font-mono'>{status.repo}</span>, so
          forkstack left its branches as they were.
        </Notice>
      )
    }
    case 'needs-signature': {
      return (
        <Notice icon='i-lucide-key-round'>
          This stack has verified commits, or its base branch requires signed commits, so forkstack
          didn&apos;t rewrite them unsigned. No branch was changed.{' '}
          {isAuthor ? (
            <>
              <Link href='/settings/signing' className='underline'>
                Add a signing key
              </Link>
              , or rebase locally with <code className='font-mono'>forkstack rebase</code>.
            </>
          ) : (
            'Ask the author to add a signing key or to rebase locally.'
          )}
        </Notice>
      )
    }
    case 'unverified': {
      return (
        <Notice icon='i-lucide-shield-alert'>
          GitHub didn&apos;t verify the signed commits (
          <code className='font-mono'>{status.reason}</code>), so no branch was changed.{' '}
          {isAuthor ? (
            <>
              Check that the public key from{' '}
              <Link href='/settings/signing' className='underline'>
                your signing key
              </Link>{' '}
              is added to your GitHub account, then try again.
            </>
          ) : (
            'Ask the author to check their signing key on GitHub.'
          )}
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
