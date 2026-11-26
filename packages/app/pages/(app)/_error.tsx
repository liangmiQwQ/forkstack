import type { ErrorPageProps } from '@void/react'

import { ErrorState } from '../../src/components/error-state.tsx'

export default function ErrorPage({ error }: ErrorPageProps) {
  return <ErrorState icon='i-lucide-circle-alert' title='Something went wrong' error={error} />
}
