import { createHash } from 'node:crypto'

import { expect, it } from 'vite-plus/test'

import { commitPayload } from '../src/commit-object.ts'

// GitHub hashes the commit it stores. When the payload hashes the same, a signature over the payload matches that commit.
it('serializes a commit to the same bytes GitHub stores', () => {
  const payload = commitPayload({
    tree: '806032acf5492c5406512565213976586b83db54',
    parent: '3c657dc56e3ed8208af391aa93315e709dfe2d56',
    // GitHub's API returns messages without the trailing newline, and stores them as sent.
    message: 'probe message',
    author: { name: 'A U Thor', email: 'author@example.com', date: '2016-06-15T08:58:57Z' },
    committer: { name: 'Probe', email: 'probe@example.com', date: '2026-11-28T00:00:00Z' }
  })

  const sha = createHash('sha1')
    .update(`commit ${Buffer.byteLength(payload)}\0${payload}`)
    .digest('hex')
  // Returned by `POST /repos/liang-demos/stacked-pr-playground/git/commits` for these fields.
  expect(sha).toBe('0151a82757bd812a1f95df3ff81e2ecd7997a42d')
})
