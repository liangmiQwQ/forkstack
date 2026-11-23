import { cli, define } from 'gunshi'
import c from 'picocolors'

import pkg from '../package.json' with { type: 'json' }

const command = define({
  name: 'forkstack',
  run: () => {
    console.error(c.red('Not implemented yet'))
    process.exitCode = 1
  }
})

await cli(process.argv.slice(2), command, {
  name: pkg.name,
  version: pkg.version,
  description: pkg.description
})
