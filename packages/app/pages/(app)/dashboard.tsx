import type { PullRequest } from '@forkstack/core/discovery'
import { Form, Link, useForm } from '@void/react'
import { Suspense, use, useId, useRef } from 'react'
import type { ComponentProps, ReactNode } from 'react'

import {
  ArchivedNotice,
  PendingIcon,
  PrList,
  PrListSkeleton,
  PrRow,
  Skeleton,
  StackRepo,
  SyncStatus
} from '../../src/components/stack.tsx'
import type { Props } from './dashboard.server.ts'

type SavedStack = Props['saved'][number]

// Archived stacks are left out of the counts and the empty state, since they need nothing from the user.
export default function DashboardPage({ saved, cachedPrs, prs }: Props) {
  const active = saved.filter(stack => !stack.deletesAt)
  const prCount = active.reduce((count, stack) => count + stack.prIds.length, 0)

  return (
    <div className='flex flex-col gap-8'>
      <header className='flex flex-wrap items-end justify-between gap-4'>
        <div className='flex flex-col gap-1'>
          <h1 className='text-2xl font-semibold'>Stacks</h1>
          <p className='text-sm text-neutral-500'>
            {active.length > 0
              ? `${active.length} ${active.length === 1 ? 'stack' : 'stacks'} · ${prCount} pull requests, linked by a forkstack comment on each one`
              : 'Pull requests you link as stacks show up here.'}
          </p>
        </div>
        {saved.length > 0 && (
          <div className='flex items-center gap-4'>
            <SyncStatus data={prs} />
            {active.length > 0 && (
              <Link href='/stacks/new' className='btn-solid'>
                <span className='i-lucide-layers-plus' />
                Link a stack
              </Link>
            )}
          </div>
        )}
      </header>

      {active.length === 0 && <EmptyState />}
      {saved.length > 0 && (
        // oxlint-disable-next-line react-perf/jsx-no-jsx-as-prop -- Suspense takes its fallback as a prop, and the React Compiler memoizes it.
        <Suspense fallback={<StackList saved={saved} cachedPrs={cachedPrs} />}>
          <FreshStackList saved={saved} cachedPrs={cachedPrs} prs={prs} />
        </Suspense>
      )}
    </div>
  )
}

interface StackSources {
  cachedPrs: PullRequest[] | null
  /** PRs fresh from GitHub, or `undefined` while the cache fills the page. */
  freshPrs?: PullRequest[]
}

function FreshStackList({ prs, ...props }: Pick<Props, 'saved' | 'cachedPrs' | 'prs'>) {
  return <StackList {...props} freshPrs={use(prs)} />
}

// Stacks whose PRs all merged move to the history, until forkstack deletes them. It starts closed, so it stays out of the way.
function StackList(props: StackSources & { saved: SavedStack[] }) {
  const archived = props.saved.filter(stack => stack.deletesAt).length

  return (
    <>
      {archived < props.saved.length && <StackCards {...props} archived={false} />}
      {archived > 0 && (
        <details className='group'>
          <summary className='flex cursor-pointer list-none items-center gap-2 text-sm text-neutral-500 hover:text-current [&::-webkit-details-marker]:hidden'>
            <span className='i-lucide-chevron-right transition-transform group-open:rotate-90' />
            <span className='i-lucide-history' />
            History · {archived}
          </summary>
          <div className='mt-3'>
            <StackCards {...props} archived />
          </div>
        </details>
      )}
    </>
  )
}

function StackCards({
  saved,
  archived,
  ...sources
}: StackSources & { saved: SavedStack[]; archived: boolean }) {
  const stacks = saved.filter(stack => Boolean(stack.deletesAt) === archived)

  return (
    <ul className='flex flex-col gap-4'>
      {stacks.map(stack => (
        <li key={stack.id}>
          <StackCard stack={stack} {...sources} />
        </li>
      ))}
    </ul>
  )
}

function StackCard({ stack, cachedPrs, freshPrs }: StackSources & { stack: SavedStack }) {
  const prs = pickPrs(stack.prIds, [cachedPrs, freshPrs])
  if (prs.length === 0 && !freshPrs) {
    return <StackCardSkeleton size={stack.prIds.length} />
  }

  return (
    <article className='card overflow-hidden'>
      <header className='card-header'>
        {prs[0] ? (
          <StackRepo repo={prs[0]} />
        ) : (
          <span className='text-sm'>Pull requests not found</span>
        )}
        <div className='flex items-center gap-3'>
          {stack.deletesAt ? (
            <ArchivedNotice deletesAt={stack.deletesAt} />
          ) : (
            <span className='text-xs text-neutral-500'>{prs.length} pull requests</span>
          )}
          <Link href={`/stacks/${stack.id}`} className='btn-ghost'>
            <span className='i-lucide-panel-top-open' />
            View
          </Link>
          {stack.deletesAt ? (
            <DeleteButton stackId={stack.id} />
          ) : (
            <UnlinkButton stackId={stack.id} />
          )}
        </div>
      </header>
      <div className='p-2'>
        <PrList baseRef={prs[0]?.baseRef ?? ''}>
          {prs.toReversed().map(pr => (
            // A stack needs two PRs, so its PRs can only be removed while it has more. An archived stack is finished, so it keeps them all.
            <RemovablePrRow key={pr.id} pr={pr} removable={prs.length > 2 && !stack.deletesAt} />
          ))}
        </PrList>
      </div>
    </article>
  )
}

function UnlinkButton({ stackId }: { stackId: string }) {
  const form = useForm('/dashboard?deleteStack', { stackId }, { throwOnError: false })

  return (
    <ConfirmButton
      form={form}
      icon='i-lucide-unlink'
      label='Unlink'
      title='Unlink this stack?'
      confirmLabel='Unlink stack'
      pendingLabel='Unlinking'
    >
      forkstack deletes its comments from these pull requests and stops managing them. The pull
      requests, branches, and commits stay as they are, and you can link them again later.
    </ConfirmButton>
  )
}

// The same action as unlinking, but an archived stack keeps its comments, so only the record goes.
function DeleteButton({ stackId }: { stackId: string }) {
  const form = useForm('/dashboard?deleteStack', { stackId }, { throwOnError: false })

  return (
    <ConfirmButton
      form={form}
      icon='i-lucide-trash-2'
      label='Delete this stack'
      iconOnly
      title='Delete this stack now?'
      confirmLabel='Delete stack'
      pendingLabel='Deleting'
    >
      forkstack forgets this stack now instead of on the date shown. The pull requests and the
      comments on them stay as they are.
    </ConfirmButton>
  )
}

function RemovablePrRow({ pr, removable }: { pr: PullRequest; removable: boolean }) {
  const form = useForm('/dashboard?removePr', { prId: pr.id }, { throwOnError: false })

  return (
    <PrRow pr={pr} faded={form.pending}>
      {removable && (
        <ConfirmButton
          form={form}
          icon='i-lucide-circle-minus'
          label={`Remove #${pr.number} from this stack`}
          iconOnly
          title={`Remove #${pr.number} from this stack?`}
          confirmLabel='Remove'
          pendingLabel='Removing'
        >
          forkstack deletes its comment from this pull request. The pull request stays open on
          GitHub, and the rest of the stack stays linked.
        </ConfirmButton>
      )}
    </PrRow>
  )
}

// Each action changes what forkstack manages, so it asks first in a dialog that says what changes and what stays.
function ConfirmButton({
  form,
  icon,
  label,
  iconOnly = false,
  title,
  confirmLabel,
  pendingLabel,
  children
}: {
  form: ComponentProps<typeof Form>['form']
  icon: string
  label: string
  iconOnly?: boolean
  title: string
  confirmLabel: string
  pendingLabel: string
  /** What the action changes, shown under the title. */
  children: ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  return (
    <>
      <button
        type='button'
        className='btn-ghost'
        disabled={form.pending}
        aria-label={iconOnly ? label : undefined}
        title={iconOnly ? label : undefined}
        onClick={() => dialog.current?.showModal()}
      >
        <PendingIcon pending={form.pending} icon={icon} />
        {!iconOnly && label}
      </button>
      {/* The padding sits on the form, so a click that lands on the dialog itself is on the backdrop. */}
      <dialog
        ref={dialog}
        className='dialog'
        aria-labelledby={titleId}
        onClick={event => {
          if (event.target === event.currentTarget && !form.pending) {
            dialog.current?.close()
          }
        }}
      >
        <Form form={form} className='flex flex-col gap-4 p-5'>
          <div className='flex flex-col gap-2'>
            <h2 id={titleId} className='font-semibold'>
              {title}
            </h2>
            <p className='text-sm text-neutral-500'>{children}</p>
          </div>
          <div className='flex justify-end gap-2'>
            <button
              type='button'
              className='btn-soft'
              disabled={form.pending}
              onClick={() => dialog.current?.close()}
            >
              Cancel
            </button>
            <button type='submit' className='btn-danger' disabled={form.pending}>
              <PendingIcon pending={form.pending} icon={icon} />
              {form.pending ? pendingLabel : confirmLabel}
            </button>
          </div>
        </Form>
      </dialog>
    </>
  )
}

function EmptyState() {
  return (
    <section className='card flex flex-col items-center gap-3 px-6 py-16 text-center'>
      <span className='i-lucide-layers text-3xl text-neutral-500' />
      <h2 className='font-medium'>No stacks yet</h2>
      <p className='max-w-sm text-sm text-neutral-500'>
        forkstack finds open pull requests from your forks that build on each other. Link them as a
        stack to manage them here.
      </p>
      <Link href='/stacks/new' className='btn-solid mt-2'>
        <span className='i-lucide-search' />
        Find stacks
      </Link>
    </section>
  )
}

// Mirrors the layout of a stack card, so the page does not jump when PRs arrive.
function StackCardSkeleton({ size }: { size: number }) {
  return (
    <div className='card overflow-hidden'>
      <div className='card-header'>
        <Skeleton className='h-5 w-72 max-w-full' />
        <Skeleton className='h-5 w-32' />
      </div>
      <div className='p-2'>
        <PrListSkeleton size={size} />
      </div>
    </div>
  )
}

// Keeps the saved order, and later sources win. PRs missing from every source were deleted on GitHub or are not cached yet.
function pickPrs(ids: string[], sources: (PullRequest[] | null | undefined)[]) {
  const prsById = new Map(sources.flatMap(prs => prs ?? []).map(pr => [pr.id, pr]))
  return ids.map(id => prsById.get(id)).filter(pr => pr !== undefined)
}
