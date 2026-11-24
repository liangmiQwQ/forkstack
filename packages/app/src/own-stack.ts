import { HTTPException } from 'hono/http-exception'

import { listStacks } from './stack.ts'
import type { StoredStack } from './stack.ts'

// Stack IDs show up in every PR's bot comment, so each request checks the caller owns the stack.
export async function findOwnStack(userId: string, stackId: string): Promise<StoredStack> {
  const stack = (await listStacks(userId)).find(stack => stack.id === stackId)
  if (!stack) {
    throw new HTTPException(404, { message: 'This stack does not exist, or is not yours.' })
  }
  return stack
}
