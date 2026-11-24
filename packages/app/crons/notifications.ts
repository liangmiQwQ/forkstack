import { defineScheduled } from 'void'

import { pollNotifications } from '../src/notifications.ts'

// Every minute, the shortest cron interval, which is also how often GitHub asks clients to poll notifications at most.
export const cron = '* * * * *'

export default defineScheduled(async () => {
  await pollNotifications()
})
