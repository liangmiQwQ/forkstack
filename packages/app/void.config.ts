import { defineConfig } from 'void/config'

export default defineConfig({
  auth: {
    providers: ['github']
  },
  cloudflare: {
    routes: [{ pattern: 'forkstack.dev', custom_domain: true }]
  },
  head: {
    titleTemplate: '%s · forkstack',
    htmlAttrs: { lang: 'en' },
    // Lets the browser draw scrollbars and form controls dark too, following the system like the styles do.
    meta: [{ name: 'color-scheme', content: 'light dark' }],
    link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }]
  },
  inference: {
    build: 'pnpm exec vp build'
  },
  routing: {
    typedRoutes: true
  },
  worker: {
    compatibility_date: '2026-02-24'
  }
})
