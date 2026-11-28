import { defineEnv, string } from 'void/env'

export default defineEnv({
  AUTH_GITHUB_CLIENT_ID: string(),
  AUTH_GITHUB_CLIENT_SECRET: string(),
  // Void creates it on deploy, and Better Auth encrypts OAuth tokens with it. Queued restacks read it to decrypt the owner's token without a session.
  BETTER_AUTH_SECRET: string().optional(),
  // A classic token of the bot account with only `public_repo` (marker comments, reading PRs) and `notifications` (noticing merges).
  // Branches are rewritten with the stack owner's OAuth token instead, so the bot never needs more.
  GITHUB_BOT_TOKEN: string(),
  // Signs the push webhooks forkstack adds to forks. Generate it with `openssl rand -hex 32`.
  GITHUB_WEBHOOK_SECRET: string(),
  // Locks the signing keys users create in settings. Generate it with `openssl rand -base64 32`. Without it, web rebases stay unsigned.
  SIGNING_KEY_SECRET: string().optional()
})
