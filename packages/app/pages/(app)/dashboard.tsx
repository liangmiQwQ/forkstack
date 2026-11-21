import { Suspense, use } from 'react'

import type { PullRequest } from '../../src/discovery.ts'
import type { Props } from './dashboard.server.ts'

export default function DashboardPage({ stacks, managed }: Props) {
  return (
    <div className='flex flex-col gap-6'>
      <div className='flex flex-col gap-1'>
        <h1 className='text-2xl font-semibold'>Possible stacks</h1>
        <p className='text-sm text-neutral-500'>
          Open pull requests from one of your forks that build on each other.
        </p>
      </div>

      {/* oxlint-disable-next-line react-perf/jsx-no-jsx-as-prop -- Suspense takes its fallback as a prop, and the React Compiler memoizes it. */}
      <Suspense fallback={<p className='text-sm text-neutral-500'>Loading pull requests…</p>}>
        <StackList stacks={stacks} managed={managed} />
      </Suspense>
    </div>
  )
}

function StackList({ stacks, managed }: Props) {
  const resolved = use(stacks)

  if (resolved.length === 0) {
    return <EmptyState />
  }

  return (
    <ul className='flex flex-col gap-4'>
      {resolved.map((stack, index) => (
        <li key={stack[0].url} className='card flex flex-col gap-4 p-5'>
          <StackHeader pr={stack[0]} />
          <div className='flex flex-col gap-2'>
            <h2 className='flex items-center gap-2 text-sm font-medium'>
              <span className='i-lucide-layers' />
              Stack of {stack.length}, bottom first
            </h2>
            <PrList prs={stack} ordered />
          </div>
          {/* oxlint-disable-next-line react-perf/jsx-no-jsx-as-prop -- Suspense takes its fallback as a prop, and the React Compiler memoizes it. */}
          <Suspense fallback={<p className='text-sm text-neutral-500'>Checking descriptions…</p>}>
            <ManagedStatus managed={managed} index={index} />
          </Suspense>
        </li>
      ))}
    </ul>
  )
}

function StackHeader({ pr }: { pr: PullRequest }) {
  return (
    <div className='flex flex-wrap items-center gap-2 font-mono text-sm'>
      <span>
        {pr.baseRepo}:{pr.baseRef}
      </span>
      <span className='i-lucide-arrow-left text-neutral-500' />
      <span className='text-neutral-500'>{pr.headRepo}</span>
    </div>
  )
}

function ManagedStatus({ managed, index }: { managed: Props['managed']; index: number }) {
  if (use(managed)[index]) {
    return (
      <p className='flex items-center gap-2 text-sm text-neutral-500'>
        <span className='i-lucide-check' />
        Already managed by forkstack
      </p>
    )
  }

  return <p className='text-sm text-neutral-500'>Not managed by forkstack yet.</p>
}

function PrList({ prs, ordered = false }: { prs: PullRequest[]; ordered?: boolean }) {
  const List = ordered ? 'ol' : 'ul'

  return (
    <List className='flex flex-col gap-1'>
      {prs.map(pr => (
        <li key={pr.url}>
          <a
            href={pr.url}
            target='_blank'
            rel='noreferrer'
            className='flex items-baseline gap-3 rounded-lg px-2 py-1.5 hover:bg-neutral-500/10'
          >
            <span className='font-mono text-sm text-neutral-500'>#{pr.number}</span>
            <span className='min-w-0 truncate'>{pr.title}</span>
            <span className='ml-auto hidden font-mono text-xs text-neutral-500 sm:inline'>
              {pr.headRef}
            </span>
          </a>
        </li>
      ))}
    </List>
  )
}

function EmptyState() {
  return (
    <section className='card flex flex-col items-center gap-3 px-6 py-16 text-center'>
      <span className='i-lucide-layers text-3xl text-neutral-500' />
      <h2 className='font-medium'>No stacks yet</h2>
      <p className='max-w-sm text-sm text-neutral-500'>
        Open pull requests from the same fork into the same branch, each built on the one below it,
        and they will show up here.
      </p>
      <a href='https://github.com/pulls' target='_blank' rel='noreferrer' className='btn-soft mt-2'>
        <span className='i-simple-icons-github' />
        Your pull requests on GitHub
      </a>
    </section>
  )
}
