import { Link } from '@void/react'
import type { ReactNode } from 'react'

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className='flex flex-col gap-8'>
      <h1 className='text-2xl font-semibold'>Settings</h1>

      <div className='flex flex-col gap-8 md:flex-row'>
        <nav className='flex shrink-0 gap-1 md:w-48 md:flex-col'>
          <Link href='/settings/account' className='nav-link'>
            <span className='i-lucide-user' />
            Account
          </Link>
        </nav>

        <div className='min-w-0 flex-1'>{children}</div>
      </div>
    </div>
  )
}
