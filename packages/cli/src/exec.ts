import { x } from 'tinyexec'

// Returns stdout without its trailing newline. A failed command throws its own error output, which already says what went wrong.
export async function exec(command: string, args: string[], stdin?: string): Promise<string> {
  const result = await x(command, args, { stdin, nodePath: false })
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.trim() || `\`${command} ${args.join(' ')}\` failed.`)
  }
  return result.stdout.replace(/\r?\n$/, '')
}
