import { Link } from '@void/react'
import { useState } from 'react'
import type { ReactNode } from 'react'

import type { Props } from './index.server.ts'

const REPO_URL = 'https://github.com/liangmiQwQ/forkstack'
const INSTALL_COMMAND = 'gh extension install liangmiQwQ/gh-forkstack'

// One example stack is shared by every illustration, so the page tells a single story. Each PR keeps its color across sections.
const STACK = [
  {
    number: 184,
    branch: 'refactor-parser',
    title: 'refactor: split the parser into stages',
    file: 'src/parser/stages.ts',
    color: 'bg-sky-500',
    indent: 'pl-3',
    isDraft: false
  },
  {
    number: 185,
    branch: 'parser-plugins',
    title: 'feat: load parser plugins',
    file: 'src/parser/plugins.ts',
    color: 'bg-amber-500',
    indent: 'pl-6',
    isDraft: false
  },
  {
    number: 186,
    branch: 'plugin-docs',
    title: 'docs: document parser plugins',
    file: 'docs/plugins.md',
    color: 'bg-rose-500',
    indent: 'pl-9',
    isDraft: true
  }
] as const

type StackPr = (typeof STACK)[number]

// The top PR's diff shows the gap most clearly, since GitHub's diff of it holds the whole stack.
const TOP = STACK[2]

const CONTRIBUTOR_COMMANDS: [command: string, comment: string][] = [
  ['git switch -c refactor-parser main', '# commit the first step'],
  ['git switch -c parser-plugins', '# commit the second step'],
  ['gh forkstack submit', '# push, open and link the PRs'],
  ['gh forkstack rebase', '# after main moves on']
]

export default function IndexPage({ signedIn }: Props) {
  return (
    <>
      {/* The header and hero fill the first screen together, so the header has no rule to break it up. */}
      <div className='flex min-h-dvh flex-col'>
        <Header signedIn={signedIn} />
        <Hero signedIn={signedIn} />
      </div>
      <main>
        <ReviewSection />
        <UpstreamSection />
        <ContributorSection />
        <ClosingSection signedIn={signedIn} />
      </main>
      <Footer />
    </>
  )
}

function Header({ signedIn }: Props) {
  return (
    <header>
      <div className='mx-auto flex h-14 max-w-6xl items-center gap-1 px-6'>
        <Link href='/' className='mr-auto flex items-center gap-2 font-semibold'>
          <span className='i-lucide-layers' />
          forkstack
        </Link>
        <Link href='/docs' className='btn-ghost'>
          <span className='i-lucide-book-open' />
          Docs
        </Link>
        <a href={REPO_URL} className='btn-ghost' aria-label='forkstack on GitHub'>
          <span className='i-simple-icons-github' />
        </a>
        <AccountLink signedIn={signedIn} className='btn-soft ml-2 whitespace-nowrap' />
      </div>
    </header>
  )
}

function AccountLink({ signedIn, className }: Props & { className: string }) {
  return signedIn ? (
    <Link href='/dashboard' className={className}>
      <span className='i-lucide-layout-dashboard' />
      Dashboard
    </Link>
  ) : (
    <Link href='/login' className={className}>
      Get started
      <span className='i-lucide-arrow-right' />
    </Link>
  )
}

function Hero({ signedIn }: Props) {
  return (
    <section className='mx-auto grid w-full max-w-6xl flex-1 content-center items-center gap-16 px-6 py-16 lg:grid-cols-[1fr_28rem]'>
      <div className='flex min-w-0 flex-col items-start gap-8'>
        <h1 className='text-5xl font-semibold tracking-[-0.035em] text-balance sm:text-6xl'>
          Stacked pull requests, from your fork.
        </h1>
        <p className='max-w-xl text-lg text-pretty text-neutral-500'>
          Open a stack of PRs from your fork. Reviewers read one step at a time, and merges restack
          the rest.
        </p>
        <div className='flex flex-wrap gap-3'>
          <AccountLink signedIn={signedIn} className='btn-solid px-4 py-2' />
          <Link href='/docs/why' className='btn-outline px-4 py-2'>
            <span className='i-lucide-lightbulb' />
            Why forkstack
          </Link>
          <GitHubButton className='btn-ghost px-4 py-2' />
        </div>
      </div>

      <HeroIllustration />
    </section>
  )
}

function GitHubButton({ className }: { className: string }) {
  return (
    <a href={REPO_URL} className={className}>
      <span className='i-simple-icons-github' />
      View on GitHub
    </a>
  )
}

function InstallCommand() {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(INSTALL_COMMAND)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className='flex max-w-full items-center gap-3 rounded-lg border border-neutral-500/20 py-1.5 pr-1.5 pl-3 font-mono text-sm'>
      <span className='text-neutral-500 select-none'>$</span>
      <code className='truncate'>{INSTALL_COMMAND}</code>
      <button
        type='button'
        className='btn-ghost'
        aria-label={copied ? 'Copied' : 'Copy the install command'}
        onClick={() => void copy()}
      >
        <span className={copied ? 'i-lucide-check' : 'i-lucide-copy'} />
      </button>
    </div>
  )
}

// The fork's branches above, and the comment forkstack posts on the upstream PR they become below.
function HeroIllustration() {
  return (
    <div className='flex min-w-0 flex-col' aria-hidden='true'>
      <ForkBranches />
      <div className='flex items-center gap-3 py-3 pl-6 font-mono text-xs text-neutral-500'>
        <span className='i-lucide-arrow-down' />
        gh forkstack submit
      </div>
      <StackComment />
    </div>
  )
}

function ForkBranches() {
  return (
    <div className='card bg-white p-4 dark:bg-neutral-950'>
      <div className='mb-3 flex items-center gap-2 text-sm text-neutral-500'>
        <span className='i-octicon-repo-forked-16' />
        <span className='font-mono'>you/parser</span>
      </div>
      <ol className='flex flex-col-reverse gap-1.5 font-mono text-sm'>
        <li className='flex items-center gap-2.5 text-neutral-500'>
          <span className='i-octicon-git-branch-16' />
          main
        </li>
        {STACK.map(pr => (
          <li key={pr.number} className={`flex items-center gap-2.5 ${pr.indent}`}>
            <span className={`size-2 rounded-full ${pr.color}`} />
            {pr.branch}
          </li>
        ))}
      </ol>
    </div>
  )
}

// Mirrors the comment from `renderComment` in core, as GitHub shows it on the middle PR.
function StackComment() {
  const current = STACK[1]

  return (
    <div className='card overflow-hidden bg-white text-sm dark:bg-neutral-950'>
      <div className='flex items-center gap-2 border-b border-neutral-500/15 bg-neutral-500/5 px-4 py-2.5'>
        <span className='i-lucide-layers' />
        <span className='font-semibold'>forkstack-service</span>
        <span className='ml-auto font-mono text-xs text-neutral-500'>#{current.number}</span>
      </div>

      <div className='flex flex-col gap-3 p-4'>
        <p className='flex items-center gap-2 font-medium text-amber-700 dark:text-amber-400'>
          <span className='i-octicon-alert-16' />
          Warning
        </p>
        <p>
          This PR is in a stack (2 of 3). Learn more about{' '}
          <span className='text-sky-700 dark:text-sky-400'>stacked PRs</span>.
        </p>
        <ul className='flex list-disc flex-col gap-1 pl-5 marker:text-neutral-500'>
          {STACK.toReversed().map(pr => (
            <PrReference key={pr.number} pr={pr} current={pr === current} />
          ))}
          <li>
            <code className='font-mono text-xs'>main</code>
          </li>
        </ul>
        <p className='flex items-center gap-2'>
          <span className='btn-outline pointer-events-none'>
            <span className='i-octicon-file-diff-16' />
            Review diff
          </span>
          <span className='btn-outline pointer-events-none'>
            <span className='i-octicon-stack-16' />
            View stack
          </span>
        </p>
      </div>
    </div>
  )
}

// Mirrors how GitHub renders a `#123` list item, with the PR's state and title.
function PrReference({ pr, current }: { pr: StackPr; current: boolean }) {
  return (
    <li>
      <span className='inline-flex items-center gap-1.5'>
        <span
          className={
            pr.isDraft
              ? 'i-octicon-git-pull-request-draft-16 shrink-0 text-neutral-500'
              : 'i-octicon-git-pull-request-16 shrink-0 text-green-600 dark:text-green-500'
          }
        />
        <span className='font-medium'>{pr.title}</span>
        <span className='text-neutral-500'>#{pr.number}</span>
        {current && <span className='text-neutral-500'>(this PR)</span>}
      </span>
    </li>
  )
}

// The sections below the full-screen hero alternate a tinted band, and share the hero's heading scale so the page reads as one piece.
function Section({ tinted = false, children }: { tinted?: boolean; children: ReactNode }) {
  return (
    <section className={tinted ? 'border-y border-neutral-500/20 bg-neutral-500/[0.03]' : ''}>
      <div className='mx-auto flex max-w-6xl flex-col gap-14 px-6 py-28 sm:py-32'>{children}</div>
    </section>
  )
}

function SectionHeading({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className='flex max-w-2xl flex-col gap-4'>
      <h2 className='text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl'>
        {title}
      </h2>
      <p className='text-lg text-pretty text-neutral-500'>{children}</p>
    </div>
  )
}

function ReviewSection() {
  return (
    <Section tinted>
      <SectionHeading title='Review one step at a time.'>
        A PR from a fork can only target <code className='font-mono'>main</code>, so GitHub&apos;s
        diff of each PR also holds every PR below it. forkstack links each PR to a diff of only its
        own changes.
      </SectionHeading>

      <div className='grid gap-6 md:grid-cols-2'>
        <DiffCard title={`GitHub's diff of #${TOP.number}`} icon='i-octicon-file-diff-16' />
        <DiffCard
          title={`forkstack's review of #${TOP.number}`}
          icon='i-lucide-layers'
          only={TOP}
        />
      </div>
    </Section>
  )
}

// Both cards list every file, so they line up row by row. With `only`, the files of the PRs below stay visible but faded.
function DiffCard({ title, icon, only }: { title: string; icon: string; only?: StackPr }) {
  const count = only ? 1 : STACK.length

  return (
    <div className={`card bg-white dark:bg-neutral-950 ${only ? 'border-neutral-500/40' : ''}`}>
      <div className='card-header'>
        <span className='flex items-center gap-2 text-sm font-medium'>
          <span className={icon} />
          {title}
        </span>
        <span className='text-xs text-neutral-500'>
          {count} {count === 1 ? 'file' : 'files'}
        </span>
      </div>
      <ul className='divide-y divide-neutral-500/15'>
        {STACK.map(pr => {
          const hidden = only !== undefined && pr !== only
          return (
            <li
              key={pr.number}
              className={`flex items-center gap-3 px-4 py-3 ${hidden ? 'opacity-35' : ''}`}
            >
              <span className={`h-5 w-1 rounded-full ${pr.color}`} />
              <span className={`flex-1 truncate font-mono text-sm ${hidden ? 'line-through' : ''}`}>
                {pr.file}
              </span>
              <span className='font-mono text-xs text-neutral-500'>
                {hidden ? `reviewed on #${pr.number}` : `from #${pr.number}`}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function UpstreamSection() {
  return (
    <Section>
      <SectionHeading title='Nothing to install upstream.'>
        Maintainers review and merge as they always do. Only the contributor sets forkstack up, on
        their own fork.
      </SectionHeading>

      <ul className='grid gap-10 md:grid-cols-3'>
        <Point icon='i-lucide-list-ordered' title='The order is visible'>
          Every PR gets a comment listing the stack bottom to top, with the live state, checks and
          review of each PR.
        </Point>
        <Point icon='i-lucide-git-merge' title='Merges need no cleanup'>
          Merge the bottom PR with any method. forkstack rebases the rest onto{' '}
          <code className='font-mono'>main</code>, so the next PR is ready to merge.
        </Point>
        <Point icon='i-lucide-shield-check' title='No access to grant'>
          forkstack needs no write access and no setup in the upstream repository.
        </Point>
      </ul>
    </Section>
  )
}

function Point({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  return (
    <li className='flex flex-col gap-4'>
      <span className='flex size-10 items-center justify-center rounded-lg border border-neutral-500/20'>
        <span className={`${icon} text-lg`} />
      </span>
      <div className='flex flex-col gap-1.5'>
        <h3 className='font-medium'>{title}</h3>
        <p className='text-neutral-500'>{children}</p>
      </div>
    </li>
  )
}

function ContributorSection() {
  return (
    <Section tinted>
      <div className='grid items-center gap-14 lg:grid-cols-[1fr_28rem]'>
        <div className='flex min-w-0 flex-col items-start gap-8'>
          <SectionHeading title='Contributors keep using git.'>
            A stack is just branches built on top of each other. One command pushes them, opens the
            PRs and links them.
          </SectionHeading>
          <InstallCommand />
          <Link href='/docs/contributing' className='btn-outline px-4 py-2'>
            <span className='i-lucide-book-open' />
            Read the contributing guide
          </Link>
        </div>
        <Terminal lines={CONTRIBUTOR_COMMANDS} />
      </div>
    </Section>
  )
}

function Terminal({ lines }: { lines: [command: string, comment: string][] }) {
  return (
    <pre className='card flex min-w-0 flex-col gap-3 overflow-x-auto bg-neutral-900 p-6 font-mono text-sm leading-7 text-neutral-100 dark:bg-neutral-950'>
      {lines.map(([command, comment]) => (
        <div key={command}>
          <div className='text-neutral-500'>{comment}</div>
          <span className='text-neutral-500 select-none'>$ </span>
          {command}
        </div>
      ))}
    </pre>
  )
}

// Mirrors the hero at the end of the page, so readers who scrolled through have the same next steps.
function ClosingSection({ signedIn }: Props) {
  return (
    <section className='mx-auto flex max-w-6xl flex-col items-center gap-8 px-6 py-28 text-center sm:py-36'>
      <h2 className='text-4xl font-semibold tracking-[-0.03em] sm:text-5xl'>
        Start your first stack.
      </h2>
      <p className='max-w-xl text-lg text-pretty text-neutral-500'>
        forkstack is free and open source, under the MIT license.
      </p>
      <div className='flex flex-wrap justify-center gap-3'>
        <AccountLink signedIn={signedIn} className='btn-solid px-4 py-2' />
        <GitHubButton className='btn-outline px-4 py-2' />
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className='border-t border-neutral-500/20'>
      <div className='mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-8 text-sm text-neutral-500'>
        <span className='mr-auto'>MIT License © Liang Mi and contributors</span>
        <Link href='/docs/why' className='hover:text-current'>
          Why forkstack
        </Link>
        <a href={REPO_URL} className='hover:text-current'>
          GitHub
        </a>
        <a href='https://github.com/sponsors/liangmiQwQ' className='hover:text-current'>
          Sponsor
        </a>
      </div>
    </footer>
  )
}
