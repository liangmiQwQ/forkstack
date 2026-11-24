// `gh` sets `GH_PATH` when it runs forkstack as an extension, and users type `gh forkstack` then.
export const COMMAND = process.env.GH_PATH ? 'gh forkstack' : 'forkstack'
