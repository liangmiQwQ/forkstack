import { Form, useForm } from '@void/react'
import { useState } from 'react'
import type { ReactNode } from 'react'

import type { PublicSigningKey } from '../../../src/signing-key.ts'
import type { Props } from './signing.server.ts'

export default function SigningSettingsPage({ signingKey, configured, emails }: Props) {
  return (
    <div className='flex flex-col gap-6'>
      <Section
        title='Signing key'
        description='A web rebase rewrites commits, which drops their signatures. With a key here, forkstack signs the new commits as you, so GitHub keeps showing them as Verified. forkstack rebase signs with your own git setup instead.'
      >
        {!configured && (
          <p className='text-sm text-neutral-500'>
            This forkstack server has no SIGNING_KEY_SECRET, so it can&apos;t store signing keys.
          </p>
        )}
        {configured &&
          (signingKey ? <KeyDetails signingKey={signingKey} /> : <CreateKey emails={emails} />)}
      </Section>
    </div>
  )
}

function CreateKey({ emails }: { emails: string[] }) {
  const form = useForm(
    '/settings/signing?create',
    { email: emails[0] ?? '' },
    { throwOnError: false }
  )

  return (
    <Form form={form} className='form-alert flex flex-col items-start gap-3'>
      <label className='flex w-full flex-col gap-1.5 text-sm'>
        <span className='font-medium'>Committer email</span>
        <span className='text-neutral-500'>
          Rebased commits name you as their committer with this email. The noreply address keeps
          your own email private.
        </span>
        <span className='input'>
          <span className='i-lucide-mail shrink-0 text-neutral-500' />
          <select
            value={form.data.email}
            onChange={event => form.setData('email', event.target.value)}
            className='min-w-0 flex-1 bg-transparent outline-none'
          >
            {emails.map(email => (
              <option key={email} value={email}>
                {email}
              </option>
            ))}
          </select>
        </span>
      </label>
      <button type='submit' className='btn-solid' disabled={form.pending}>
        <span className='i-lucide-key-round' />
        Generate key
      </button>
    </Form>
  )
}

function KeyDetails({ signingKey }: { signingKey: PublicSigningKey }) {
  const form = useForm('/settings/signing?remove', {}, { throwOnError: false })
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(signingKey.publicKey)
    setCopied(true)
  }

  return (
    <div className='flex flex-col gap-4'>
      <p className='text-sm'>
        Signs as {signingKey.name} <span className='font-mono'>&lt;{signingKey.email}&gt;</span>.
        Add this public key to your GitHub account as a GPG key. Until then, GitHub can&apos;t
        verify the signed commits, and forkstack stops a rebase before it moves any branch.
      </p>
      <textarea
        readOnly
        value={signingKey.publicKey}
        rows={10}
        aria-label='Public key'
        className='w-full resize-none rounded-lg border border-neutral-500/25 bg-transparent p-3 font-mono text-xs'
      />
      <div className='flex flex-wrap gap-3'>
        <button type='button' className='btn-outline' onClick={() => void copy()}>
          <span className={copied ? 'i-lucide-check' : 'i-lucide-copy'} />
          {copied ? 'Copied' : 'Copy public key'}
        </button>
        <a
          href='https://github.com/settings/gpg/new'
          target='_blank'
          rel='noreferrer'
          className='btn-outline'
        >
          <span className='i-lucide-external-link' />
          Add to GitHub
        </a>
      </div>
      <Form form={form} className='form-alert flex flex-col items-start gap-2 pt-2'>
        <p className='text-sm text-neutral-500'>
          Deleting the key stops forkstack from signing. Remove it on GitHub too, so GitHub no
          longer trusts it for new commits. You can create a new key afterwards.
        </p>
        <button type='submit' className='btn-danger' disabled={form.pending}>
          <span className='i-lucide-trash-2' />
          Delete key
        </button>
      </Form>
    </div>
  )
}

function Section({
  title,
  description,
  children
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className='card flex flex-col gap-4 p-5'>
      <div className='flex flex-col gap-1'>
        <h2 className='font-medium'>{title}</h2>
        {description && <p className='text-sm text-neutral-500'>{description}</p>}
      </div>
      {children}
    </section>
  )
}
