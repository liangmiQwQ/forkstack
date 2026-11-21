import { defineConfig, presetIcons, presetWebFonts, presetWind4 } from 'unocss'

// Emphasis levels follow DESIGN.md: soft fill by default, outline for edges, solid for the main action.
export default defineConfig({
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
  shortcuts: {
    btn: 'inline-flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-opacity disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500',
    'btn-soft': 'btn bg-neutral-500/10 hover:bg-neutral-500/15',
    'btn-outline': 'btn border border-neutral-500/25 hover:bg-neutral-500/5',
    'btn-solid':
      'btn bg-neutral-900 text-white hover:opacity-90 dark:bg-white dark:text-neutral-900',
    'btn-danger': 'btn border border-red-600/30 text-red-700 hover:bg-red-600/5 dark:text-red-400',
    card: 'rounded-xl border border-neutral-500/20',
    skeleton: 'rounded-md bg-neutral-500/10 motion-safe:animate-pulse',
    'nav-link':
      'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-neutral-500 hover:text-current data-[void-active]:bg-neutral-500/10 data-[void-active]:text-current'
  }
})
