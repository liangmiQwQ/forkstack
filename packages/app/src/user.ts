import type { AuthUser } from 'void/auth'

export interface Profile {
  name: string
  email: string
  image: string | null
  githubLogin: string | null
}

// Loader props are serialized as JSON, so pass only plain fields instead of the full user with its Date values.
export function toProfile(user: AuthUser): Profile {
  return {
    name: user.name,
    email: user.email,
    image: user.image ?? null,
    githubLogin: user.githubLogin ?? null
  }
}
