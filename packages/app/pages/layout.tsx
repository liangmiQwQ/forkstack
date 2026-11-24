import 'virtual:uno.css'
import type { ReactNode } from 'react'

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <div className='min-h-dvh font-sans text-neutral-900 antialiased dark:text-neutral-100'>
      {children}
    </div>
  )
}
