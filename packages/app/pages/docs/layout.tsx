import './docs.css'
import { useFrontmatter } from '@void/md'
import { Link } from '@void/react'
import type { ReactNode } from 'react'

// Listed by hand to keep the reading order, and so typed routes check each link. Titles match each page's frontmatter.
const PAGES = [
  { href: '/docs', title: 'Getting started' },
  { href: '/docs/contributing', title: 'Contributing' },
  { href: '/docs/why', title: 'Why forkstack' }
] as const

export default function DocsLayout({ children }: { children: ReactNode }) {
  // Markdown pages ship no client router, so `Link` can't mark the current page and the server does it instead.
  const { title } = useFrontmatter()

  return (
    <>
      <header className='border-b border-neutral-500/20'>
        <div className='mx-auto flex h-14 max-w-5xl items-center gap-6 px-6'>
          <Link href='/docs' className='flex items-center gap-2 font-semibold'>
            <span className='i-lucide-layers' />
            forkstack
          </Link>
          <a
            href='https://github.com/liangmiQwQ/forkstack'
            className='btn-ghost ml-auto'
            aria-label='forkstack on GitHub'
          >
            <span className='i-simple-icons-github' />
          </a>
        </div>
      </header>

      <div className='mx-auto flex max-w-5xl flex-col gap-8 px-6 pt-10 pb-20 md:flex-row'>
        <nav className='flex shrink-0 gap-1 md:w-48 md:flex-col'>
          {PAGES.map(page => (
            <Link
              key={page.href}
              href={page.href}
              aria-current={page.title === title ? 'page' : undefined}
              className='nav-link aria-[current=page]:bg-neutral-500/10 aria-[current=page]:text-current'
            >
              {page.title}
            </Link>
          ))}
        </nav>
        <main className='docs min-w-0 max-w-2xl flex-1'>{children}</main>
      </div>
    </>
  )
}
