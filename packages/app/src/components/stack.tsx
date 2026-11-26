import type { PullRequest } from '@forkstack/core/discovery'
import { Suspense, use, useState } from 'react'
import type { ReactNode } from 'react'

import type { RepoPair } from '../stack.ts'

/** The repository a stack merges into, and the fork its branches live in. */
export function StackRepo({ repo }: { repo: RepoPair }) {
  return (
    <div className='flex min-w-0 flex-wrap items-center gap-x-2 font-mono text-sm'>
      <span>{repo.baseRepo}</span>
      <span className='i-lucide-arrow-left text-neutral-500' title='from' />
      <span className='text-neutral-500'>{repo.headRepo}</span>
    </div>
  )
}

// Like GitHub's stack view, the top PR comes first and the branch the stack merges into closes the list.
// So `children` are rows from the top PR down, usually `PrRow`s.
export function PrList({ baseRef, children }: { baseRef: string; children: ReactNode }) {
  return (
    <ol className='flex flex-col'>
      {children}
      <li className='flex items-center gap-1 py-1'>
        <span className='flex w-6 shrink-0 justify-center'>
          <span className='size-2.5 rounded-full border-2 border-neutral-500/60' />
        </span>
        <span className='ml-2 rounded-md bg-neutral-500/10 px-1.5 py-0.5 font-mono text-xs'>
          {baseRef}
        </span>
      </li>
    </ol>
  )
}

/** A PR in a `PrList`, laid out like GitHub's PR list. `children` go after the PR, such as a button that acts on it. */
export function PrRow({
  pr,
  faded = false,
  children
}: {
  pr: PullRequest
  faded?: boolean
  children?: ReactNode
}) {
  return (
    <li className={`flex items-stretch gap-1 transition-opacity ${faded ? 'opacity-50' : ''}`}>
      {/* The line under the icon joins this PR to the one below it. */}
      <span className='flex w-6 shrink-0 flex-col items-center gap-1 pt-2.5 pb-1'>
        <PrStateIcon pr={pr} />
        <span className='w-px flex-1 bg-neutral-500/30' />
      </span>
      <a
        href={pr.url}
        target='_blank'
        rel='noreferrer'
        className='flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-neutral-500/10'
      >
        <span className='flex min-w-0 flex-1 flex-col gap-0.5'>
          <span className='flex min-w-0 items-center gap-2'>
            <span className='min-w-0 truncate font-semibold'>{pr.title}</span>
            <ChecksIcon checks={pr.checks} />
          </span>
          <span className='flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs text-neutral-500'>
            <span>#{pr.number}</span>
            <Dot />
            <span className='min-w-0 truncate'>{pr.headRef}</span>
            <ReviewStatus pr={pr} />
            {pr.updatedAt && (
              <>
                <Dot />
                <UpdatedAt iso={pr.updatedAt} />
              </>
            )}
          </span>
        </span>
        {pr.comments > 0 && (
          <span
            className='flex shrink-0 items-center gap-1 text-xs text-neutral-500'
            title={`${pr.comments} comments`}
          >
            <span className='i-octicon-comment-16' />
            {pr.comments}
          </span>
        )}
      </a>
      {children && <span className='self-center'>{children}</span>}
    </li>
  )
}

function Dot() {
  return <span aria-hidden='true'>·</span>
}

const RELATIVE_UNITS: [unit: Intl.RelativeTimeFormatUnit, seconds: number][] = [
  ['year', 365 * 24 * 60 * 60],
  ['month', 30 * 24 * 60 * 60],
  ['week', 7 * 24 * 60 * 60],
  ['day', 24 * 60 * 60],
  ['hour', 60 * 60],
  ['minute', 60]
]

// The server and the browser render this at slightly different times, so a changed minute is not a hydration error.
function UpdatedAt({ iso }: { iso: string }) {
  // Read once, so the text stays stable across re-renders.
  const [now] = useState(Date.now)
  const seconds = (new Date(iso).getTime() - now) / 1000
  const [unit, size] = RELATIVE_UNITS.find(([, size]) => Math.abs(seconds) >= size) ?? ['second', 1]
  const text = new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
    Math.round(seconds / size),
    unit
  )

  return (
    <time dateTime={iso} title={new Date(iso).toLocaleString()} suppressHydrationWarning>
      Updated {text}
    </time>
  )
}

// Icons and colors follow GitHub, so a PR's state reads the same as on github.com.
export function PrStateIcon({ pr }: { pr: PullRequest }) {
  const [icon, label] = prState(pr)
  return <span className={`shrink-0 ${icon}`} role='img' aria-label={label} title={label} />
}

function prState(pr: PullRequest): [icon: string, label: string] {
  if (pr.state === 'MERGED') {
    return ['i-octicon-git-merge-16 text-purple-600 dark:text-purple-400', 'Merged']
  }
  if (pr.state === 'CLOSED') {
    return ['i-octicon-git-pull-request-closed-16 text-red-600 dark:text-red-400', 'Closed']
  }
  if (pr.isDraft) {
    return ['i-octicon-git-pull-request-draft-16 text-neutral-500', 'Draft']
  }
  return ['i-octicon-git-pull-request-16 text-green-600 dark:text-green-500', 'Open']
}

export function ChecksIcon({ checks }: { checks: PullRequest['checks'] }) {
  switch (checks) {
    case 'passing': {
      return (
        <StatusIcon
          icon='i-octicon-check-16 text-green-600 dark:text-green-500'
          label='Checks passing'
        />
      )
    }
    case 'failing': {
      return (
        <StatusIcon icon='i-octicon-x-16 text-red-600 dark:text-red-400' label='Checks failing' />
      )
    }
    case 'running': {
      return (
        <StatusIcon
          icon='i-octicon-dot-fill-16 text-amber-600 dark:text-amber-400'
          label='Checks running'
        />
      )
    }
    default: {
      return null
    }
  }
}

function ReviewStatus({ pr }: { pr: PullRequest }) {
  // A draft is not ready for review, so GitHub's review decision does not apply yet.
  if (pr.state !== 'OPEN' || pr.isDraft) {
    return null
  }

  switch (pr.reviewDecision) {
    case 'APPROVED': {
      return (
        <ReviewLabel
          icon='i-octicon-check-16 text-green-600 dark:text-green-500'
          label='Approved'
        />
      )
    }
    case 'CHANGES_REQUESTED': {
      return (
        <ReviewLabel
          icon='i-octicon-file-diff-16 text-red-600 dark:text-red-400'
          label='Changes requested'
        />
      )
    }
    case 'REVIEW_REQUIRED': {
      return <ReviewLabel icon='i-octicon-eye-16' label='Review required' />
    }
    default: {
      return null
    }
  }
}

function StatusIcon({ icon, label }: { icon: string; label: string }) {
  return <span className={`shrink-0 ${icon}`} role='img' aria-label={label} title={label} />
}

function ReviewLabel({ icon, label }: { icon: string; label: string }) {
  return (
    <>
      <Dot />
      <span className='flex items-center gap-1'>
        <span className={`shrink-0 ${icon}`} />
        {label}
      </span>
    </>
  )
}

/** Shows "Syncing with GitHub" until `data` resolves. */
export function SyncStatus({ data }: { data: Promise<unknown> }) {
  return (
    // oxlint-disable-next-line react-perf/jsx-no-jsx-as-prop -- Suspense takes its fallback as a prop, and the React Compiler memoizes it.
    <Suspense fallback={<Syncing />}>
      <Synced data={data} />
    </Suspense>
  )
}

function Synced({ data }: { data: Promise<unknown> }) {
  use(data)
  return null
}

function Syncing() {
  return (
    <span className='flex items-center gap-1.5 text-xs text-neutral-500' role='status'>
      <span className='i-lucide-refresh-cw motion-safe:animate-spin' />
      Syncing with GitHub
    </span>
  )
}

export function PendingIcon({ pending, icon }: { pending: boolean; icon: string }) {
  return <span className={pending ? 'i-lucide-loader-circle motion-safe:animate-spin' : icon} />
}

export function Skeleton({ className }: { className: string }) {
  return <div className={`skeleton ${className}`} />
}

// Mirrors the layout of a `PrList`, so the page does not jump when PRs arrive.
export function PrListSkeleton({ size }: { size: number }) {
  return (
    <div className='flex flex-col' aria-busy='true' aria-label='Loading pull requests'>
      {Array.from({ length: size }, (_, index) => (
        <div key={index} className='flex items-center gap-3 py-1.5 pr-2 pl-8'>
          <Skeleton className='h-5 w-10' />
          <Skeleton className='h-5 flex-1' />
          <Skeleton className='hidden h-4 w-28 sm:block' />
        </div>
      ))}
    </div>
  )
}
