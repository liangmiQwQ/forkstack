import type { PullRequest } from '@forkstack/core/discovery'
import { stackPrTable, stackTable } from '@schema'
import { asc, db, eq, inArray } from 'void/db'
import type { SQL } from 'void/db'

export interface StoredStack {
  id: string
  /** The forkstack user who linked the stack, the only one who can change it. */
  userId: string
  /** The stack's PRs, bottom to top. */
  prs: StoredPr[]
  repo: { baseRepo: string; headRepo: string }
}

export interface StoredPr {
  /** GitHub's GraphQL node ID. */
  id: string
  commentId: string | null
}

export function listStacks(userId: string): Promise<StoredStack[]> {
  return queryStacks(eq(stackTable.userId, userId))
}

export async function getStack(id: string): Promise<StoredStack | null> {
  const stacks = await queryStacks(eq(stackTable.id, id))
  return stacks.at(0) ?? null
}

export async function findStackId(prId: string): Promise<string | null> {
  const rows = await db
    .select({ stackId: stackPrTable.stackId })
    .from(stackPrTable)
    .where(eq(stackPrTable.prId, prId))
  return rows.at(0)?.stackId ?? null
}

// D1 has no interactive transactions, so the inserts go in one batch to keep a stack from being saved without its PRs.
export async function createStack(userId: string, prs: PullRequest[]): Promise<string> {
  const bottom = prs.at(0)
  if (!bottom?.headRepo) {
    throw new Error('A stack needs a pull request from a fork.')
  }

  const id = crypto.randomUUID()
  const rows = prs.map((pr, position) => ({ prId: pr.id, stackId: id, position }))

  await db.batch([
    db
      .insert(stackTable)
      .values({ id, userId, baseRepo: bottom.baseRepo, headRepo: bottom.headRepo }),
    db.insert(stackPrTable).values(rows)
  ])
  return id
}

export async function deleteStack(id: string): Promise<void> {
  await db.delete(stackTable).where(eq(stackTable.id, id))
}

export async function saveCommentId(prId: string, commentId: string): Promise<void> {
  await db.update(stackPrTable).set({ commentId }).where(eq(stackPrTable.prId, prId))
}

export async function removePrs(prIds: string[]): Promise<void> {
  await db.delete(stackPrTable).where(inArray(stackPrTable.prId, prIds))
}

async function queryStacks(where: SQL): Promise<StoredStack[]> {
  const rows = await db
    .select({
      stackId: stackTable.id,
      userId: stackTable.userId,
      baseRepo: stackTable.baseRepo,
      headRepo: stackTable.headRepo,
      prId: stackPrTable.prId,
      commentId: stackPrTable.commentId
    })
    .from(stackTable)
    .innerJoin(stackPrTable, eq(stackPrTable.stackId, stackTable.id))
    .where(where)
    .orderBy(asc(stackTable.createdAt), asc(stackPrTable.position))

  const stacks = new Map<string, StoredStack>()
  for (const row of rows) {
    const stack = stacks.get(row.stackId) ?? {
      id: row.stackId,
      userId: row.userId,
      prs: [],
      repo: { baseRepo: row.baseRepo, headRepo: row.headRepo }
    }
    stack.prs.push({ id: row.prId, commentId: row.commentId })
    stacks.set(row.stackId, stack)
  }

  return [...stacks.values()]
}
