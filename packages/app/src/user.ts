import { userTable } from '@auth-schema'
import type { AuthUser } from 'void/auth'
import { db, eq } from 'void/db'

export interface Profile {
  name: string
  /** GitHub login, or `null` until the user signs in again after this field was added. */
  login: string | null
  email: string
  image: string | null
}

// Loader props are serialized as JSON, so pass only plain fields instead of the full user with its Date values.
export function toProfile(user: AuthUser): Profile {
  return {
    name: user.name,
    login: user.login ?? null,
    email: user.email,
    image: user.image ?? null
  }
}

// The stack page is public, so it shows only the handle and avatar GitHub already shows on the PRs, never the email.
export async function getPublicProfile(
  userId: string
): Promise<Pick<Profile, 'name' | 'login' | 'image'>> {
  const user = await db
    .select({ name: userTable.name, login: userTable.login, image: userTable.image })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .get()
  return {
    name: user?.name ?? 'Unknown',
    login: user?.login ?? null,
    image: user?.image ?? null
  }
}
