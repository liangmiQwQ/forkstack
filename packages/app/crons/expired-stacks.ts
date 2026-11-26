import { defineScheduled } from 'void'

import { deleteExpiredStacks } from '../src/stack-archive.ts'

// Hourly, so an archived stack is gone within an hour of the date its page shows.
export const cron = '0 * * * *'

export default defineScheduled(async () => {
  await deleteExpiredStacks()
})
