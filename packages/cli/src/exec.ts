import { x } from 'tinyexec'

// Returns stdout without its trailing newline. A failed command throws its own error output, which already says what went wrong.
export async function exec(command: string, args: string[], stdin?: string): Promise<string> {
  const result = await x(command, args, { stdin, nodePath: false })
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.trim() || `\`${command} ${args.join(' ')}\` failed.`)
  }
  return result.stdout.replace(/\r?\n$/, '')
}

// For git commands the user should watch, such as a rebase that stops at a conflict. Returns whether the command succeeded.
export async function execInteractive(
  command: string,
  args: string[],
  env: Record<string, string> = {}
): Promise<boolean> {
  const result = await x(command, args, {
    nodePath: false,
    nodeOptions: { stdio: 'inherit', env: { ...process.env, ...env } }
  })
  return result.exitCode === 0
}
