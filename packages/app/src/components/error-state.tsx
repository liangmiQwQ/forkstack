import { Link, useShared } from '@void/react'
import type { ErrorPageProps } from '@void/react'

// Loaders throw `HTTPException` with messages written for visitors, so the message is shown as is.
export function ErrorState({
  icon,
  title,
  error
}: ErrorPageProps & { icon: string; title: string }) {
  const { profile } = useShared()

  return (
    <section className='card flex flex-col items-center gap-3 px-6 py-16 text-center' role='alert'>
      <span className={`${icon} text-3xl text-neutral-500`} />
      <h1 className='font-medium'>{title}</h1>
      <p className='max-w-sm text-sm text-neutral-500'>{error.message}</p>
      {/* Visitors from a PR comment are often signed out, and the dashboard would send them to sign in. */}
      <Link href={profile ? '/dashboard' : '/'} className='btn-outline mt-2'>
        <span className='i-lucide-arrow-left' />
        {profile ? 'Back to dashboard' : 'Go home'}
      </Link>
    </section>
  )
}
