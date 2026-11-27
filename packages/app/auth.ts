import { defineAuth } from 'void/auth'

export default defineAuth(({ defaults, env }) => ({
  ...defaults,
  socialProviders: {
    github: {
      // `env` is untyped here, and `void/env` is unavailable when Void reads this file at build time. Void checks both values exist before it runs.
      clientId: String(env.AUTH_GITHUB_CLIENT_ID),
      clientSecret: String(env.AUTH_GITHUB_CLIENT_SECRET),
      // An OAuth App token acts as the user on any public repo, which a GitHub App user token cannot do on upstream repos it isn't installed on.
      scope: ['public_repo'],
      overrideUserInfoOnSignIn: true,
      // The display name is often blank. The login is what GitHub shows next to PRs.
      mapProfileToUser: profile => ({ login: profile.login })
    }
  },
  user: {
    additionalFields: {
      login: {
        type: 'string',
        required: false,
        input: false
      }
    },
    deleteUser: { enabled: true }
  },
  account: {
    encryptOAuthTokens: true
  }
}))
