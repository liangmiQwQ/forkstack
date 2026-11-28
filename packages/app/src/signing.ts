import * as openpgp from 'openpgp'

export interface Signer {
  /** The key's user ID. GitHub verifies a commit only when its committer email matches it. */
  committer: { name: string; email: string }
  /** Returns an ASCII-armored detached signature. */
  sign: (payload: string) => Promise<string>
}

// GitHub's create-commit API accepts only PGP signatures, not SSH ones. A v4 Ed25519 key is what GitHub lists as EdDSA.
// It has no encryption subkey, since forkstack only signs with it.
export async function generateSigningKey(
  person: { name: string; email: string },
  passphrase: string
): Promise<{ publicKey: string; privateKey: string }> {
  const { publicKey, privateKey } = await openpgp.generateKey({
    type: 'ecc',
    curve: 'ed25519Legacy',
    userIDs: [person],
    subkeys: [],
    passphrase,
    format: 'armored'
  })
  return { publicKey, privateKey }
}

export async function openSigner(
  armoredKey: string,
  passphrase: string,
  committer: Signer['committer']
): Promise<Signer> {
  const signingKeys = await openpgp.decryptKey({
    privateKey: await openpgp.readPrivateKey({ armoredKey }),
    passphrase
  })
  return {
    committer,
    sign: async payload =>
      openpgp.sign({
        // Git signs the commit's raw bytes, so the message must not be treated as text with normalized line endings.
        message: await openpgp.createMessage({ binary: new TextEncoder().encode(payload) }),
        signingKeys,
        detached: true
      })
  }
}
