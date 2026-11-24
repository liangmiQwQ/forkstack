import { defineEnv, string } from 'void/env'

export default defineEnv({
  AUTH_GITHUB_CLIENT_ID: string(),
  AUTH_GITHUB_CLIENT_SECRET: string(),
  GITHUB_BOT_TOKEN: string(),
  GITHUB_APP_ID: string(),
  // The app's URL name, used to link users to its install page.
  GITHUB_APP_SLUG: string(),
  // WebCrypto only reads PKCS#8 keys, while GitHub hands out PKCS#1. Convert it with `openssl pkcs8 -topk8 -nocrypt -in key.pem`.
  GITHUB_APP_PRIVATE_KEY: string(),
  GITHUB_APP_WEBHOOK_SECRET: string()
})
