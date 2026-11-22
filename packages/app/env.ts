import { defineEnv, string } from 'void/env'

export default defineEnv({
  AUTH_GITHUB_CLIENT_ID: string(),
  AUTH_GITHUB_CLIENT_SECRET: string(),
  GITHUB_BOT_TOKEN: string()
})
