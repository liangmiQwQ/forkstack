import { Link } from '@void/react'
import type { Href } from 'void/routes'

import type { Props } from './install.server.ts'

export default function InstallPage({ login, next, installUrl }: Props) {
  return (
    <main className='mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-6'>
      <div className='flex flex-col gap-2'>
        <div className='flex items-center gap-2 text-lg font-semibold'>
          <span className='i-lucide-layers' />
          forkstack
        </div>
        <p className='text-sm text-neutral-500'>
          Install the GitHub App on your forks, so forkstack can push rebased branches for you.
        </p>
      </div>

      <ol className='card flex flex-col divide-y divide-neutral-500/20 text-sm'>
        <li className='flex items-center gap-3 px-4 py-3 text-neutral-500'>
          <span className='i-lucide-circle-check shrink-0' />
          <span>
            Signed in as <span className='font-mono'>{login}</span>
          </span>
        </li>
        <li className='flex items-center gap-3 px-4 py-3'>
          <span className='i-lucide-plug shrink-0' />
          Install the GitHub App
        </li>
      </ol>

      <div className='flex flex-col gap-3'>
        <a href={installUrl} className='btn-solid w-full py-2'>
          <span className='i-simple-icons-github' />
          Install on GitHub
        </a>
        <Link href={next as Href} className='btn-ghost self-center'>
          Skip for now
          <span className='i-lucide-arrow-right' />
        </Link>
      </div>

      <p className='text-xs text-neutral-500'>
        Pick only the forks you stack pull requests from. Nothing is installed on upstream
        repositories.
      </p>
    </main>
  )
}
