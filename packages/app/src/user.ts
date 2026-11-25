import { userTable } from '@auth-schema'
import type { AuthUser } from 'void/auth'
import { db, eq } from 'void/db'

export interface Profile {
  name: string
  email: string
  image: string | null
}

// Loader props are serialized as JSON, so pass only plain fields instead of the full user with its Date values.
export function toProfile(user: AuthUser): Profile {
  return {
    name: user.name,
    email: user.email,
    image: user.image ?? null
  }
}

// The stack page is public, so it shows only the name and avatar GitHub already shows on the PRs, never the email.
export async function getPublicProfile(userId: string): Promise<Pick<Profile, 'name' | 'image'>> {
  const user = await db
    .select({ name: userTable.name, image: userTable.image })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .get()
  return { name: user?.name ?? 'Unknown', image: user?.image ?? null }
}
