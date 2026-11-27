import type { PullRequest } from '@forkstack/core/discovery'
import { stackPrTable, stackTable } from '@schema'
import { and, asc, db, eq, inArray, isNull, lte } from 'void/db'
import type { SQL } from 'void/db'

export interface StoredStack {
  id: string
  /** The forkstack user who linked the stack, the only one who can change it. */
  userId: string
  /** The stack's PRs, bottom to top. */
  prs: StoredPr[]
  repo: { baseRepo: string; headRepo: string }
  /** When every PR had merged, or `null` while any is open. */
  archivedAt: Date | null
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

export function listArchivedBefore(date: Date): Promise<StoredStack[]> {
  return queryStacks(lte(stackTable.archivedAt, date))
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

// Rewrites which PRs belong to a stack without changing its id, so links to it keep working.
// Comment ids of PRs that stay are kept. New PRs have none until a marker is posted.
export async function replaceStackPrs(stack: StoredStack, prs: PullRequest[]): Promise<void> {
  const commentIds = new Map(stack.prs.map(pr => [pr.id, pr.commentId]))
  const rows = prs.map((pr, position) => ({
    prId: pr.id,
    stackId: stack.id,
    position,
    commentId: commentIds.get(pr.id) ?? null
  }))

  await db.batch([
    db.delete(stackPrTable).where(eq(stackPrTable.stackId, stack.id)),
    db.insert(stackPrTable).values(rows)
  ])
}

export async function deleteStack(id: string): Promise<void> {
  await db.delete(stackTable).where(eq(stackTable.id, id))
}

// Only the first call sets the time, so the deletion date shown on the stack stays the same.
export async function archiveStack(id: string): Promise<void> {
  await db
    .update(stackTable)
    .set({ archivedAt: new Date() })
    .where(and(eq(stackTable.id, id), isNull(stackTable.archivedAt)))
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
      archivedAt: stackTable.archivedAt,
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
      repo: { baseRepo: row.baseRepo, headRepo: row.headRepo },
      archivedAt: row.archivedAt
    }
    stack.prs.push({ id: row.prId, commentId: row.commentId })
    stacks.set(row.stackId, stack)
  }

  return [...stacks.values()]
}
