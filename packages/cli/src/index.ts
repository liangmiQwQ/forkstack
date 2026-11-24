import { cli, define } from 'gunshi'
import c from 'picocolors'

import pkg from '../package.json' with { type: 'json' }
import { COMMAND } from './command.ts'
import { checkout } from './commands/checkout.ts'
import { login } from './commands/login.ts'
import { bottom, down, switchBranch, top, trunk, up } from './commands/navigation.ts'
import { rebase } from './commands/rebase.ts'
import { submit } from './commands/submit.ts'
import { sync } from './commands/sync.ts'
import { unstack } from './commands/unstack.ts'
import { view } from './commands/view.ts'

const main = define({
  name: COMMAND,
  run: () => {
    console.error(`Run ${c.cyan(`${COMMAND} --help`)} to see the commands.`)
    process.exitCode = 1
  }
})

try {
  await cli(process.argv.slice(2), main, {
    name: COMMAND,
    version: pkg.version,
    description: pkg.description,
    // The header repeats on every command, and errors read better without it.
    renderHeader: null,
    subCommands: {
      login,
      submit,
      view,
      checkout,
      unstack,
      rebase,
      sync,
      up,
      down,
      top,
      bottom,
      trunk,
      switch: switchBranch
    }
  })
} catch (error) {
  // Errors from forkstack, git and gh are written for the user, so only their message is shown.
  console.error(c.red(error instanceof Error ? error.message : String(error)))
  process.exitCode = 1
}
