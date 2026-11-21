import 'virtual:uno.css'
import type { ReactNode } from 'react'

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <div className='min-h-dvh bg-white font-sans text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100'>
      {children}
    </div>
  )
}
