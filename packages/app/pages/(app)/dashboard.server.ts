import { defineHandler, defineHead } from 'void'
import { requireAuth } from 'void/auth'

export const loader = defineHandler(c => {
  requireAuth(c, { throwRedirect: '/login' })
})

export const head = defineHead(() => ({ title: 'Dashboard' }))
