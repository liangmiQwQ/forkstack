import { exec } from './exec.ts'

export function git(...args: string[]): Promise<string> {
  return exec('git', args)
}

export async function currentBranch(): Promise<string> {
  const branch = await git('branch', '--show-current')
  if (!branch) {
    throw new Error('Check out a branch first. HEAD is detached.')
  }
  return branch
}
