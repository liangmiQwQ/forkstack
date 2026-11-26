import { index, integer, sqliteTable, text } from 'void/schema-d1'

import { userTable } from '../.void/better-auth-schema.ts'
import type { RestackStatus } from '../src/restack-status.ts'

// The database is the source of truth for stacks. PRs only carry the stack ID as a marker in a bot comment.
export const stackTable = sqliteTable(
  'stack',
  {
    id: text('id').primaryKey(),
    userId: text('userId')
      .notNull()
      .references(() => userTable.id, { onDelete: 'cascade' }),
    // The repository the stack merges into and the fork its branches live in, so pages can name the stack before GitHub answers.
    // `null` for stacks saved before these columns, until their page is viewed.
    baseRepo: text('baseRepo'),
    headRepo: text('headRepo'),
    restackStatus: text('restackStatus', { mode: 'json' }).$type<RestackStatus>(),
    createdAt: integer('createdAt', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date())
  },
  table => [index('stack_userId_idx').on(table.userId)]
)

export const stackPrTable = sqliteTable(
  'stack_pr',
  {
    // GitHub's GraphQL node ID. It is unique across repositories, so a PR can only join one stack.
    prId: text('prId').primaryKey(),
    stackId: text('stackId')
      .notNull()
      .references(() => stackTable.id, { onDelete: 'cascade' }),
    // Sorts the stack bottom to top. Removing a PR leaves a gap instead of renumbering the rest.
    position: integer('position').notNull(),
    // GraphQL node ID of the bot's marker comment, so it can be deleted later. `null` until the comment is posted.
    commentId: text('commentId')
  },
  table => [index('stack_pr_stackId_idx').on(table.stackId)]
)
