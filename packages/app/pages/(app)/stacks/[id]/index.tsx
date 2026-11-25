import { Link } from '@void/react'

import { PrList, PrRow, StackRepo } from '../../../../src/components/stack.tsx'
import type { StackNotice } from '../../../../src/stack-notice.ts'
import type { Props } from './index.server.ts'

export default function StackPage({ stackId, prs, notice }: Props) {
  return (
    <div className='flex flex-col gap-6'>
      <header className='flex flex-col gap-3'>
        <h1 className='text-2xl font-semibold'>Stack</h1>
        <p className='max-w-2xl text-sm text-neutral-500'>
          These pull requests build on each other and merge from the bottom up. Review each one on
          its own diff, which leaves out the pull requests below it.
        </p>
      </header>

      <article className='card overflow-hidden'>
        <header className='card-header'>
          {prs[0] && <StackRepo pr={prs[0]} />}
          {notice && <RestackLink stackId={stackId} notice={notice} />}
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

// Restacks after a merge run without anyone watching, so the owner's link says when the stack needs them.
function RestackLink({ stackId, notice }: { stackId: string; notice: StackNotice }) {
  return (
    <Link
      href={`/stacks/${stackId}/restack`}
      className={`btn-outline ${notice.kind === 'problem' ? 'text-amber-600 dark:text-amber-400' : ''}`}
    >
      <span className={NOTICE_ICONS[notice.kind]} />
      {notice.label}
    </Link>
  )
}

const NOTICE_ICONS: Record<StackNotice['kind'], string> = {
  idle: 'i-octicon-sync-16',
  running: 'i-octicon-clock-16',
  problem: 'i-octicon-alert-16'
}
