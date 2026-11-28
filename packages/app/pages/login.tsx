import { useState } from 'react'
import { auth } from 'void/client'

import type { Props } from './login.server.ts'

export default function LoginPage({ error, next }: Props) {
  const [pending, setPending] = useState(false)

  function signIn() {
    setPending(true)
    void auth.signIn.social({
      provider: 'github',
      callbackURL: next,
      errorCallbackURL: `/login?next=${encodeURIComponent(next)}`
    })
  }

  return (
    <main className='mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-6'>
      <div className='flex flex-col gap-2'>
        <div className='flex items-center gap-2 text-lg font-semibold'>
          <span className='i-lucide-layers' />
          forkstack
        </div>
        <p className='text-sm text-neutral-500'>Stacked pull requests across GitHub forks.</p>
      </div>

      <div className='flex flex-col gap-3'>
        <button type='button' className='btn-solid w-full py-2' disabled={pending} onClick={signIn}>
          <span className='i-simple-icons-github' />
          {pending ? 'Redirecting to GitHub…' : 'Continue with GitHub'}
        </button>
        {error && (
          <p role='alert' className='text-sm text-red-700 dark:text-red-400'>
            Sign in failed ({error}). Please try again.
          </p>
        )}
      </div>

      <p className='text-xs text-neutral-500'>
        forkstack asks for access to your public repositories so it can update your pull requests
        for you, and to add a push webhook to the forks you link.
      </p>
    </main>
  )
}
