import type { RestackResult } from './restack.ts'

export type RestackStatus = (RestackResult | { state: 'running' } | { state: 'failed' }) & {
  at: string
}

// A worker that stopped reporting must eventually allow another attempt.
export const RESTACK_TIMEOUT_MS = 15 * 60 * 1000
