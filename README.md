# forkstack

[GitHub's native stacked PRs](https://docs.github.com/en/pull-requests/get-started/about-stacked-prs#where-can-you-use-stacked-pull-requests) require all branches to be in the same repository.

But what about contributors working from forks? That is how forkstack was born: **To bring stacked PRs from forks to upstream repositories**.

## Getting started

Create your account at [forkstack.dev/login](https://forkstack.dev/login), then read the docs:

- Contributors: [Contributing with forkstack](https://forkstack.dev/docs/contributing)
- Reviewers and maintainers: [Getting started](https://forkstack.dev/docs)

## Features

- **Visible order.** Every PR in the stack gets a comment listing the stack bottom to top, with the live state, checks and review of each PR.
- **Review one PR at a time.** The comment links to a diff with only the changes that PR adds, instead of GitHub's diff, which also holds every PR below it.
- **Restack after merges.** When the bottom PR merges, forkstack rebases the rest of the stack onto `main` on GitHub, so the next PR is ready to merge.
- **Just git.** A stack is branches built on top of each other. `forkstack submit` pushes them to your fork, opens the upstream PRs and links them.
- **Nothing to install upstream.** Maintainers review and merge as they always do, with any merge method.

## Why not just let your agent restack everything?

Sure, an agent can rebase your branches and force-push them once. But keeping a stack in shape until the last PR merges takes more than that.

Merges don't wait for your agent. Each time the bottom PR merges, the rest of the stack needs a rebase, and an agent only acts when you ask, so you end up watching upstream and prompting it after every merge. forkstack restacks on GitHub as soon as the merge lands, even when your machine is off.

Without a CLI, the agent also works out the rebase and push commands from scratch on each run, and one wrong `--onto` or force-push can drop commits. `forkstack submit` and `forkstack sync` run the same steps every time, so the agent only has to call them.

Rebasing only fixes your side, too. Upstream still sees PRs that all target `main`, with nothing telling reviewers the order, and each diff full of changes from the PRs below it. forkstack shows the stack on every PR and gives each PR a diff of its own changes.

Agents still have a part to play, and forkstack gives them the context they need. The comment on each PR holds a hidden note for AI agents: a reviewing agent learns which commits belong to that PR, and a coding agent learns which branch each change goes to. The [forkstack skill](./skills/forkstack/SKILL.md) tells your own agent when to split work into a stack, how to build one and which command to run.

## Sponsor

The project is free to use, but cloud assets still cost quite a lot to implement some of the features.

Personally, I also need to dedicate a significant amount of time outside of school to maintaining this project as an ungraduated student.

If you find forkstack useful, please consider [sponsoring me](https://github.com/sponsors/liangmiQwQ).

## License

[MIT](./LICENSE) License © [Liang Mi](https://github.com/liangmiQwQ) and contributors.
