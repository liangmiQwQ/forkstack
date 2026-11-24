import { cli, define } from 'gunshi'
import c from 'picocolors'

import pkg from '../package.json' with { type: 'json' }
import { rebase } from './commands/rebase.ts'
import { submit } from './commands/submit.ts'
import { view } from './commands/view.ts'

const main = define({
  name: 'forkstack',
  run: () => {
    console.error(`Run ${c.cyan('forkstack --help')} to see the commands.`)
    process.exitCode = 1
  }
})

try {
  await cli(process.argv.slice(2), main, {
    name: pkg.name,
    version: pkg.version,
    description: pkg.description,
    // The header repeats on every command, and errors read better without it.
    renderHeader: null,
    subCommands: { rebase, submit, view }
  })
} catch (error) {
  // Errors from forkstack, git and gh are written for the user, so only their message is shown.
  console.error(c.red(error instanceof Error ? error.message : String(error)))
  process.exitCode = 1
}
