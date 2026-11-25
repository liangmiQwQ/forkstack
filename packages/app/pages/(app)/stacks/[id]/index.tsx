import { Link } from '@void/react'
import type { ReactNode } from 'react'

import { PrList, PrRow, StackRepo } from '../../../../src/components/stack.tsx'
import type { StackNotice } from '../../../../src/stack-notice.ts'
import type { Props } from './index.server.ts'

export default function StackPage({ stackId, prs, notice, owner, canRebase, signedIn }: Props) {
  return (
    <div className='flex flex-col gap-6'>
      <header className='flex flex-col gap-3'>
        {signedIn && (
          <Link href='/dashboard' className='nav-link -ml-2.5 self-start'>
            <span className='i-lucide-arrow-left' />
            Stacks
          </Link>
        )}
        <div className='flex flex-wrap items-end justify-between gap-4'>
          <div className='flex min-w-0 flex-col gap-1'>
            <h1 className='text-2xl font-semibold'>Stack</h1>
            {prs[0] && <StackRepo pr={prs[0]} />}
          </div>
          <StackState stackId={stackId} notice={notice} canRebase={canRebase} signedIn={signedIn} />
        </div>
      </header>

      <StackSummary prs={prs} owner={owner} />

      <article className='card overflow-hidden'>
        <header className='card-header'>
          <span className='flex items-center gap-2 text-sm font-medium'>
            <span className='i-octicon-git-pull-request-16 text-neutral-500' />
            {prs.length} pull requests
          </span>
          {prs[0] && (
            <span className='text-xs text-neutral-500'>
              Merges bottom up into <span className='font-mono'>{prs[0].baseRef}</span>
            </span>
          )}
        </header>
        <div className='p-2'>
          <PrList baseRef={prs[0]?.baseRef ?? ''}>
            {prs.toReversed().map(pr => (
              <PrRow key={pr.id} pr={pr}>
                {pr.reviewUrl && (
                  <a href={pr.reviewUrl} target='_blank' rel='noreferrer' className='btn-ghost'>
                    <span className='i-octicon-file-diff-16' />
                    Review diff
                  </a>
                )}
              </PrRow>
            ))}
          </PrList>
        </div>
      </article>
    </div>
  )
}

// Counts come from the PRs alone, so a visitor from a PR comment sees how far the stack is without opening each one.
function StackSummary({ prs, owner }: Pick<Props, 'prs' | 'owner'>) {
  const merged = prs.filter(pr => pr.state === 'MERGED').length
  const open = prs.filter(pr => pr.state === 'OPEN')
  // Drafts are not ready for review, like in `PrRow`.
  const ready = open.filter(pr => !pr.isDraft)
  const approved = ready.filter(pr => pr.reviewDecision === 'APPROVED').length
  const checks = (result: Props['prs'][number]['checks']) =>
    open.filter(pr => pr.checks === result).length

  return (
    <dl className='card grid grid-cols-2 divide-neutral-500/15 sm:grid-cols-4 sm:divide-x'>
      <SummaryItem icon='i-octicon-git-merge-16' label='Merged'>
        <span>
          {merged} of {prs.length}
        </span>
        <MergeBar prs={prs} />
      </SummaryItem>
      <SummaryItem icon='i-octicon-eye-16' label='Approved'>
        {ready.length > 0 ? `${approved} of ${ready.length}` : 'None ready'}
      </SummaryItem>
      <SummaryItem icon='i-octicon-checklist-16' label='Checks'>
        {joinCounts([
          [checks('passing'), 'passing'],
          [checks('failing'), 'failing'],
          [checks('running'), 'running']
        ]) || 'None'}
      </SummaryItem>
      <SummaryItem icon='i-octicon-person-16' label='Linked by'>
        <span className='flex min-w-0 items-center gap-2'>
          {owner.image && (
            <img
              src={owner.image}
              alt=''
              className='size-5 shrink-0 rounded-full border border-neutral-500/20'
            />
          )}
          <span className='truncate'>{owner.name}</span>
        </span>
      </SummaryItem>
    </dl>
  )
}

function SummaryItem({
  icon,
  label,
  children
}: {
  icon: string
  label: string
  children: ReactNode
}) {
  return (
    <div className='flex min-w-0 flex-col gap-1.5 px-4 py-3'>
      <dt className='flex items-center gap-1.5 text-xs text-neutral-500'>
        <span className={icon} />
        {label}
      </dt>
      <dd className='flex min-w-0 flex-col gap-2 text-sm font-medium'>{children}</dd>
    </div>
  )
}

// One segment per PR, bottom to top, colored like the merged and closed PR icons.
function MergeBar({ prs }: Pick<Props, 'prs'>) {
  return (
    <span className='flex h-1.5 gap-0.5' aria-hidden='true'>
      {prs.map(pr => (
        <span key={pr.id} className={`flex-1 rounded-full ${STATE_COLORS[pr.state]}`} />
      ))}
    </span>
  )
}

// Open PRs stay gray, so the bar fills up only as the stack lands.
const STATE_COLORS: Record<Props['prs'][number]['state'], string> = {
  MERGED: 'bg-purple-600 dark:bg-purple-400',
  CLOSED: 'bg-red-600 dark:bg-red-400',
  OPEN: 'bg-neutral-500/20'
}

// Leaves out zero counts, so "3 passing · 1 failing" reads without noise.
function joinCounts(counts: [count: number, label: string][]) {
  return counts
    .filter(([count]) => count > 0)
    .map(([count, label]) => `${count} ${label}`)
    .join(' · ')
}

// Restacks after a merge run without anyone watching, so the state shows whether the stack needs its owner.
// Only the owner can rebase, so everyone else sees the state as text, and an up-to-date stack has nothing to rebase.
function StackState({
  stackId,
  notice,
  canRebase,
  signedIn
}: {
  stackId: string
  notice: StackNotice
  canRebase: boolean
  signedIn: boolean
}) {
  const color = notice.kind === 'problem' ? 'text-amber-600 dark:text-amber-400' : ''
  const needsOwner = notice.kind === 'idle' || notice.kind === 'problem'

  if (canRebase && notice.kind !== 'current') {
    return (
      <Link href={`/stacks/${stackId}/restack`} className={`btn-outline ${color}`}>
        <span className={NOTICE_ICONS[notice.kind]} />
        {notice.label}
      </Link>
    )
  }

  const state = (
    <span className={`flex items-center gap-2 text-sm ${color}`}>
      <span className={NOTICE_ICONS[notice.kind]} />
      {/* The idle label names the owner's action, which reads as an instruction to anyone else. */}
      {notice.kind === 'idle' && !canRebase ? 'Needs a rebase' : notice.label}
    </span>
  )
  if (signedIn || !needsOwner) {
    return state
  }
  // Authors mostly arrive from the PR comment, often signed out, so they need a way back to the rebase controls.
  return (
    <span className='flex items-center gap-3'>
      {state}
      <Link href={`/login?next=${encodeURIComponent(`/stacks/${stackId}`)}`} className='btn-ghost'>
        <span className='i-octicon-sign-in-16' />
        Sign in to rebase
      </Link>
    </span>
  )
}

const NOTICE_ICONS: Record<StackNotice['kind'], string> = {
  idle: 'i-octicon-sync-16',
  current: 'i-octicon-check-16',
  running: 'i-octicon-clock-16',
  problem: 'i-octicon-alert-16'
}
