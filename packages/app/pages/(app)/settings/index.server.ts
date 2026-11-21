import { defineHandler } from 'void'

export const loader = defineHandler(c => c.redirect('/settings/account'))
