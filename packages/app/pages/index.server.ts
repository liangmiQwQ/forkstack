import { defineHandler } from 'void'
import { getUser } from 'void/auth'

// There is no landing page yet, so the root only routes visitors into the app.
export const loader = defineHandler(c => c.redirect(getUser() ? '/dashboard' : '/login'))
