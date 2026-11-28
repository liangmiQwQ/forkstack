import { Form, useForm } from '@void/react'
import type { ReactNode } from 'react'

import { formatIdentity } from '../../../src/identity.ts'
import type { Props } from './account.server.ts'

export default function AccountSettingsPage({ profile, scopes }: Props) {
  const signOutForm = useForm('/settings/account?signOut', {})
  const deleteForm = useForm('/settings/account?deleteAccount', {}, { throwOnError: false })

  return (
    <div className='flex flex-col gap-6'>
      <Section title='Profile' description='Synced from GitHub each time you sign in.'>
        <div className='flex items-center gap-4'>
          {profile.image && (
            <img
              src={profile.image}
              alt=''
              className='size-14 rounded-full border border-neutral-500/20'
            />
          )}
          <div className='flex min-w-0 flex-col'>
            <span className='font-medium'>{formatIdentity(profile.login, profile.name)}</span>
            {profile.login && profile.name && (
              <span className='truncate text-sm text-neutral-500'>{profile.name}</span>
            )}
            <span className='truncate text-sm text-neutral-500'>{profile.email}</span>
          </div>
        </div>
      </Section>

      <Section title='GitHub connection' description='Permissions you granted to forkstack.'>
        <div className='flex flex-col gap-4'>
          <ul className='flex flex-wrap gap-2'>
            {scopes.map(scope => (
              <li
                key={scope}
                className='rounded-md bg-neutral-500/10 px-2 py-0.5 font-mono text-xs'
              >
                {scope}
              </li>
            ))}
          </ul>
          <a
            href='https://github.com/settings/applications'
            target='_blank'
            rel='noreferrer'
            className='btn-outline self-start'
          >
            <span className='i-lucide-external-link' />
            Manage on GitHub
          </a>
        </div>
      </Section>

      <Section title='Session'>
        <Form form={signOutForm}>
          <button type='submit' className='btn-outline' disabled={signOutForm.pending}>
            <span className='i-lucide-log-out' />
            Sign out
          </button>
        </Form>
      </Section>

      <Section
        title='Delete account'
        description='Removes your forkstack account and stored GitHub token. Revoke the GitHub authorization separately under Manage on GitHub.'
      >
        <Form form={deleteForm} className='flex flex-col items-start gap-3'>
          <label className='flex items-center gap-2 text-sm'>
            <input type='checkbox' required />I understand this cannot be undone.
          </label>
          <button type='submit' className='btn-danger' disabled={deleteForm.pending}>
            <span className='i-lucide-trash-2' />
            Delete account
          </button>
        </Form>
      </Section>
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
