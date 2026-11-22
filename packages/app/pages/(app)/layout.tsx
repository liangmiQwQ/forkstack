import { Link, useNavigation, useShared } from '@void/react'
import type { ReactNode } from 'react'

export default function AppLayout({ children }: { children: ReactNode }) {
  const { profile } = useShared()

  return (
    <>
      <NavigationProgress />
      <header className='border-b border-neutral-500/20'>
        <div className='mx-auto flex h-14 max-w-5xl items-center gap-6 px-6'>
          <Link href='/dashboard' className='flex items-center gap-2 font-semibold'>
            <span className='i-lucide-layers' />
            forkstack
          </Link>

          <nav className='flex items-center gap-1'>
            <Link href='/dashboard' className='nav-link'>
              <span className='i-lucide-layout-dashboard' />
              Dashboard
            </Link>
            <Link href='/settings/account' activeMatch='prefix' className='nav-link'>
              <span className='i-lucide-settings' />
              Settings
            </Link>
          </nav>

          {profile?.image && (
            <Link href='/settings/account' className='ml-auto' aria-label='Account settings'>
              <img
                src={profile.image}
                alt=''
                className='size-7 rounded-full border border-neutral-500/20'
              />
            </Link>
          )}
        </div>
      </header>

      <main className='mx-auto max-w-5xl px-6 py-10'>{children}</main>
    </>
  )
}

// A thin bar at the top tells users a click is being handled while the next page or an action loads.
function NavigationProgress() {
  const navigation = useNavigation()
  if (navigation.state === 'idle') {
    return null
  }

  return (
    <div
      className='fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden'
      role='progressbar'
      aria-label='Loading'
    >
      <div className='h-full w-2/5 bg-neutral-900 motion-safe:animate-[progress_1.2s_ease-in-out_infinite] dark:bg-white' />
    </div>
  )
}
