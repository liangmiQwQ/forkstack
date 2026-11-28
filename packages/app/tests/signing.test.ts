import * as openpgp from 'openpgp'
import { expect, it } from 'vite-plus/test'

import { generateSigningKey, openSigner } from '../src/signing.ts'

const person = { name: 'Ada Lovelace', email: 'ada@example.com' }
const payload =
  'tree abc\nparent def\nauthor A <a@example.com> 0 +0000\ncommitter A <a@example.com> 0 +0000\n\nreplay'

it('signs a commit with the generated key, so its public key verifies the signature', async () => {
  const { publicKey, privateKey } = await generateSigningKey(person, 'server secret')
  const signer = await openSigner(privateKey, 'server secret', person)

  const signature = await signer.sign(payload)

  const { signatures } = await openpgp.verify({
    message: await openpgp.createMessage({ binary: new TextEncoder().encode(payload) }),
    signature: await openpgp.readSignature({ armoredSignature: signature }),
    verificationKeys: await openpgp.readKey({ armoredKey: publicKey })
  })
  await expect(signatures[0].verified).resolves.toBe(true)
})

it('cannot open a stored key without the server secret', async () => {
  const { privateKey } = await generateSigningKey(person, 'server secret')

  await expect(openSigner(privateKey, 'another secret', person)).rejects.toThrow(
    'Incorrect key passphrase'
  )
})
