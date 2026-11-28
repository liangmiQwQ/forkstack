import { signingKeyTable } from '@schema'
import { db, eq } from 'void/db'
import { env } from 'void/env'

import { generateSigningKey, openSigner } from './signing.ts'
import type { Signer } from './signing.ts'

export interface PublicSigningKey {
  name: string
  email: string
  publicKey: string
}

// The private key never leaves the server, so only these fields are read for pages.
export function findSigningKey(userId: string): Promise<PublicSigningKey | undefined> {
  return db
    .select({
      name: signingKeyTable.name,
      email: signingKeyTable.email,
      publicKey: signingKeyTable.publicKey
    })
    .from(signingKeyTable)
    .where(eq(signingKeyTable.userId, userId))
    .get()
}

export async function createSigningKey(
  userId: string,
  person: { name: string; email: string }
): Promise<void> {
  const { publicKey, privateKey } = await generateSigningKey(person, requireSecret())
  await db
    .insert(signingKeyTable)
    .values({ userId, ...person, publicKey, privateKey })
    .onConflictDoNothing()
}

export async function deleteSigningKey(userId: string): Promise<void> {
  await db.delete(signingKeyTable).where(eq(signingKeyTable.userId, userId))
}

// `null` when the user has no key. A key that can't be opened throws, so a rebase they expect to be signed never goes out unsigned.
export async function loadSigner(userId: string): Promise<Signer | null> {
  const row = await db
    .select()
    .from(signingKeyTable)
    .where(eq(signingKeyTable.userId, userId))
    .get()
  return row
    ? openSigner(row.privateKey, requireSecret(), { name: row.name, email: row.email })
    : null
}

export function isSigningConfigured(): boolean {
  return Boolean(env.SIGNING_KEY_SECRET)
}

function requireSecret() {
  if (!env.SIGNING_KEY_SECRET) {
    throw new Error('SIGNING_KEY_SECRET is not set on the server.')
  }
  return env.SIGNING_KEY_SECRET
}
