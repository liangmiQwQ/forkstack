import type { PullRequest } from '@forkstack/core/discovery'
import { Form, Link, useForm } from '@void/react'
import { Suspense, use, useState } from 'react'

import {
  PendingIcon,
  PrStateIcon,
  Skeleton,
  StackRepo,
  SyncStatus
} from '../../../src/components/stack.tsx'
import type { Props } from './new.server.ts'

// A stack keeps its index in the loader's list, since `managed` is aligned with that list.
interface Candidate {
  prs: PullRequest[]
  index: number
}

export default function NewStackPage({ cachedStacks, stacks, managed }: Props) {
  const [query, setQuery] = useState('')

  return (
    <div className='flex flex-col gap-6'>
      <header className='flex flex-col gap-3'>
        <Link href='/dashboard' className='nav-link -ml-2.5 self-start'>
          <span className='i-lucide-arrow-left' />
          Dashboard
        </Link>
        <h1 className='text-2xl font-semibold'>Link a stack</h1>
        <p className='max-w-2xl text-sm text-neutral-500'>
          forkstack found these open pull requests from your forks, each built on the one below it.
          Linking a stack adds a forkstack comment to each pull request. Nothing else changes on
          GitHub.
        </p>
      </header>

      <div className='flex flex-wrap items-center gap-x-4 gap-y-2'>
        <label className='input flex-1'>
          <span className='i-lucide-search shrink-0 text-neutral-500' />
          <input
            type='search'
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder='Search by repository, branch, title, or PR number'
            aria-label='Search stacks'
            className='min-w-0 flex-1 bg-transparent outline-none placeholder:text-neutral-500 [&::-webkit-search-cancel-button]:hidden'
          />
        </label>
        <SyncStatus data={stacks} />
      </div>

      {/* oxlint-disable-next-line react-perf/jsx-no-jsx-as-prop -- Suspense takes its fallback as a prop, and the React Compiler memoizes it. */}
      <Suspense fallback={<CachedCandidateList stacks={cachedStacks} query={query} />}>
        <FreshCandidateList stacks={stacks} managed={managed} query={query} />
      </Suspense>
    </div>
  )
}

function CachedCandidateList({ stacks, query }: { stacks: PullRequest[][] | null; query: string }) {
  return stacks ? <CandidateList stacks={stacks} query={query} /> : <CandidateListSkeleton />
}

function FreshCandidateList({
  stacks,
  managed,
  query
}: Pick<Props, 'stacks' | 'managed'> & { query: string }) {
  return <CandidateList stacks={use(stacks)} managed={managed} query={query} />
}

// Without `managed`, the list comes from the cache and its order may not match `managed`, so linking waits for fresh stacks.
function CandidateList({
  stacks,
  managed,
  query
}: {
  stacks: PullRequest[][]
  managed?: Props['managed']
  query: string
}) {
  if (stacks.length === 0) {
    return <EmptyState />
  }

  const candidates = stacks
    .map((prs, index) => ({ prs, index }))
    .filter(candidate => matches(candidate.prs, query))

  return (
    <div className='flex flex-col gap-2'>
      <p className='text-xs text-neutral-500'>
        {candidates.length} of {stacks.length} {stacks.length === 1 ? 'stack' : 'stacks'}
      </p>
      {candidates.length === 0 ? (
        <p className='card px-4 py-10 text-center text-sm text-neutral-500'>
          No stacks match “{query}”.
        </p>
      ) : (
        <ul className='card divide-y divide-neutral-500/15'>
          {candidates.map(candidate => (
            <CandidateRow key={candidate.prs[0].id} candidate={candidate} managed={managed} />
          ))}
        </ul>
      )}
    </div>
  )
}

// Every word must appear somewhere in the stack, so "guearth vite" narrows to one stack.
function matches(prs: PullRequest[], query: string) {
  const text = [
    prs[0].baseRepo,
    prs[0].baseRef,
    prs[0].headRepo,
    ...prs.flatMap(pr => [`#${pr.number}`, pr.title, pr.headRef])
  ]
    .join(' ')
    .toLowerCase()
  return query
    .toLowerCase()
    .split(/\s+/)
    .every(word => text.includes(word))
}

function CandidateRow({
  candidate,
  managed
}: {
  candidate: Candidate
  managed?: Props['managed']
}) {
  const form = useForm(
    '/stacks/new?createStack',
    { prIds: candidate.prs.map(pr => pr.id) },
    { throwOnError: false }
  )

  return (
    <li
      className={`flex flex-col gap-3 p-4 transition-opacity sm:flex-row sm:items-center ${form.pending ? 'opacity-50' : ''}`}
      aria-busy={form.pending}
    >
      <div className='flex min-w-0 flex-1 flex-col gap-2'>
        <StackRepo pr={candidate.prs[0]} />
        {/* Top PR first, like GitHub's stack view. */}
        <ol className='flex flex-col gap-1 text-sm'>
          {candidate.prs.toReversed().map(pr => (
            <li key={pr.id} className='flex min-w-0 items-center gap-2'>
              <PrStateIcon pr={pr} />
              <a
                href={pr.url}
                target='_blank'
                rel='noreferrer'
                className='flex min-w-0 items-baseline gap-2 hover:underline'
              >
                <span className='truncate font-medium'>{pr.title}</span>
                <span className='shrink-0 text-xs text-neutral-500'>#{pr.number}</span>
              </a>
            </li>
          ))}
          <li className='flex items-center gap-2 text-xs text-neutral-500'>
            <span className='flex w-4 justify-center'>
              <span className='size-2 rounded-full border-2 border-neutral-500/60' />
            </span>
            <span className='font-mono'>{candidate.prs[0].baseRef}</span>
          </li>
        </ol>
      </div>

      <Form
        form={form}
        className='form-alert flex shrink-0 flex-col items-start gap-2 sm:items-end'
      >
        {managed ? (
          <>
            <button type='submit' className='btn-outline' disabled={form.pending}>
              <PendingIcon pending={form.pending} icon='i-lucide-link' />
              {form.pending ? 'Linking' : 'Link'}
            </button>
            {}
            <Suspense fallback={null}>
              <ManagedNote managed={managed} index={candidate.index} />
            </Suspense>
          </>
        ) : (
          <Skeleton className='h-8 w-20' />
        )}
      </Form>
    </li>
  )
}

function ManagedNote({ managed, index }: { managed: Props['managed']; index: number }) {
  if (!use(managed)[index]) {
    return null
  }
  return <p className='text-xs text-neutral-500'>Already has forkstack comments</p>
}

function EmptyState() {
  return (
    <section className='card flex flex-col items-center gap-3 px-6 py-16 text-center'>
      <span className='i-lucide-layers text-3xl text-neutral-500' />
      <h2 className='font-medium'>No stacks to link</h2>
      <p className='max-w-sm text-sm text-neutral-500'>
        Open pull requests from one fork into the same branch, each built on the one below it, and
        they show up here.
      </p>
      <a href='https://github.com/pulls' target='_blank' rel='noreferrer' className='btn-soft mt-2'>
        <span className='i-simple-icons-github' />
        Your pull requests on GitHub
      </a>
    </section>
  )
}

// Mirrors the layout of the list, so the page does not jump when stacks arrive.
function CandidateListSkeleton() {
  return (
    <ul
      className='card divide-y divide-neutral-500/15'
      aria-busy='true'
      aria-label='Loading stacks'
    >
      {[3, 2].map(size => (
        <li key={size} className='flex items-center gap-3 p-4'>
          <div className='flex flex-1 flex-col gap-2'>
            <Skeleton className='h-5 w-72 max-w-full' />
            {Array.from({ length: size }, (_, index) => (
              <Skeleton key={index} className='h-4 w-80 max-w-full' />
            ))}
          </div>
          <Skeleton className='h-8 w-20' />
        </li>
      ))}
    </ul>
  )
}
