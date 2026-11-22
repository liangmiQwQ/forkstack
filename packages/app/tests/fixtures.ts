import type { PullRequest } from '../src/discovery.ts'

export function pr(number: number, overrides: Partial<PullRequest> = {}): PullRequest {
  return {
    id: `node-${number}`,
    number,
    title: `PR ${number}`,
    url: url(number),
    baseRepo: 'upstream/repo',
    baseRef: 'main',
    headRepo: 'me/repo',
    headRef: `branch-${number}`,
    headOid: `oid-${number}`,
    commits: [`oid-${number}`],
    state: 'OPEN',
    isDraft: false,
    reviewDecision: null,
    updatedAt: '2026-01-01T00:00:00Z',
    comments: 0,
    checks: null,
    ...overrides
  }
}

export function url(number: number) {
  return `https://github.com/upstream/repo/pull/${number}`
}
