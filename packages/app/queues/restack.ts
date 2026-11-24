import { defineQueue } from 'void'

import { runRestack } from '../src/restack-job.ts'

interface Message {
  stackId: string
  onMain: boolean
}

// A failed restack is not retried, since the user may have pushed in between and should decide again.
export const maxRetries = 0

export default defineQueue<Message>(async batch => {
  for (const message of batch.messages) {
    await runRestack(message.body.stackId, message.body.onMain)
  }
})
