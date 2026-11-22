import { stackPrTable, stackTable } from '@schema'
import { asc, db, eq } from 'void/db'

export interface StoredStack {
  id: string
  /** The stack's PRs, bottom to top. */
  prs: StoredPr[]
}

export interface StoredPr {
  /** GitHub's GraphQL node ID. */
  id: string
  commentId: string | null
}

export async function listStacks(userId: string): Promise<StoredStack[]> {
  const rows = await db
    .select({ stackId: stackTable.id, prId: stackPrTable.prId, commentId: stackPrTable.commentId })
    .from(stackTable)
    .innerJoin(stackPrTable, eq(stackPrTable.stackId, stackTable.id))
    .where(eq(stackTable.userId, userId))
    .orderBy(asc(stackTable.createdAt), asc(stackPrTable.position))

  const stacks = new Map<string, StoredPr[]>()
  for (const row of rows) {
    const pr = { id: row.prId, commentId: row.commentId }
    stacks.set(row.stackId, [...(stacks.get(row.stackId) ?? []), pr])
  }

  return [...stacks].map(([id, prs]) => ({ id, prs }))
}

// D1 has no interactive transactions, so the inserts go in one batch to keep a stack from being saved without its PRs.
export async function createStack(userId: string, prIds: string[]): Promise<string> {
  const id = crypto.randomUUID()
  const prs = prIds.map((prId, position) => ({ prId, stackId: id, position }))

  await db.batch([
    db.insert(stackTable).values({ id, userId }),
    db.insert(stackPrTable).values(prs)
  ])
  return id
}

export async function deleteStack(id: string): Promise<void> {
  await db.delete(stackTable).where(eq(stackTable.id, id))
}

export async function saveCommentId(prId: string, commentId: string): Promise<void> {
  await db.update(stackPrTable).set({ commentId }).where(eq(stackPrTable.prId, prId))
}

export async function removePr(prId: string): Promise<void> {
  await db.delete(stackPrTable).where(eq(stackPrTable.prId, prId))
}
