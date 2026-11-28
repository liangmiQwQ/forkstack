import { useState } from 'react'
import { auth } from 'void/client'

// Signing in again while signed in asks GitHub for the scopes forkstack wants now, and Better Auth saves the new grant.
export function ReauthorizeButton({ callbackURL }: { callbackURL: string }) {
  const [pending, setPending] = useState(false)

  function reauthorize() {
    setPending(true)
    void auth.signIn.social({ provider: 'github', callbackURL, errorCallbackURL: callbackURL })
  }

  return (
    <button
      type='button'
      className='btn-outline self-start'
      disabled={pending}
      onClick={reauthorize}
    >
      <span className='i-simple-icons-github' />
      {pending ? 'Redirecting to GitHub…' : 'Reauthorize with GitHub'}
    </button>
  )
}
