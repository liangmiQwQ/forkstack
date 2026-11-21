import { defineConfig } from 'void/config'

export default defineConfig({
  cloudflare: {
    routes: [{ pattern: 'forkstack.dev', custom_domain: true }]
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
