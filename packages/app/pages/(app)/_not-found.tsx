import type { ErrorPageProps } from '@void/react'

import { ErrorState } from '../../src/components/error-state.tsx'

export default function NotFound({ error }: ErrorPageProps) {
  return <ErrorState icon='i-lucide-search-x' title='Not found' error={error} />
}
