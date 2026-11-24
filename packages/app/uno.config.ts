import { defineConfig, presetIcons, presetWebFonts, presetWind4 } from 'unocss'

// Emphasis levels follow DESIGN.md: soft fill by default, outline for edges, solid for the main action.
export default defineConfig({
  // Include lazy routes in the stylesheet served with the first page render.
  content: { filesystem: ['pages/**/*.tsx', 'src/**/*.tsx'] },
  presets: [
    presetWind4({ dark: 'media' }),
    presetIcons(),
    presetWebFonts({
      provider: 'google',
      inlineImports: false,
      fonts: {
        sans: 'Instrument Sans:400,500,600',
        mono: 'IBM Plex Mono:400,500'
      }
    })
  ],
  preflights: [
    {
      getCSS: () =>
        '@keyframes progress { from { transform: translateX(-100%) } to { transform: translateX(250%) } }'
    },
    {
      // The page background sits on `html`, so overscroll and the browser's own UI match it in dark mode.
      getCSS: ({ theme }) =>
        `html { color-scheme: light dark; background: ${theme.colors.white} }
        @media (prefers-color-scheme: dark) { html { background: ${theme.colors.neutral[950]} } }`
    }
  ],
  shortcuts: {
    btn: 'inline-flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-opacity disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500',
    'btn-soft': 'btn bg-neutral-500/10 hover:bg-neutral-500/15',
    'btn-outline': 'btn border border-neutral-500/25 hover:bg-neutral-500/5',
    'btn-solid':
      'btn bg-neutral-900 text-white hover:opacity-90 dark:bg-white dark:text-neutral-900',
    'btn-danger': 'btn border border-red-600/30 text-red-700 hover:bg-red-600/5 dark:text-red-400',
    card: 'rounded-xl border border-neutral-500/20',
    input:
      'flex items-center gap-2 rounded-lg border border-neutral-500/25 px-3 py-2 text-sm focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-neutral-500',
    'card-header':
      'flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-neutral-500/15 px-4 py-3',
    'btn-ghost': 'btn px-2 text-neutral-500 hover:bg-neutral-500/10 hover:text-current',
    // `Form` shows action errors in a `role="alert"` element, which most forms here leave to this style.
    'form-alert':
      '[&_[role=alert]]:text-sm [&_[role=alert]]:text-red-700 dark:[&_[role=alert]]:text-red-400',
    dialog:
      'form-alert m-auto w-[min(28rem,calc(100%-2rem))] rounded-xl border border-neutral-500/20 bg-white text-neutral-900 backdrop:bg-black/50 dark:bg-neutral-900 dark:text-neutral-100',
    skeleton: 'rounded-md bg-neutral-500/10 motion-safe:animate-pulse',
    'nav-link':
      'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-neutral-500 hover:text-current data-[void-active]:bg-neutral-500/10 data-[void-active]:text-current data-[void-pending]:opacity-60'
  }
})
