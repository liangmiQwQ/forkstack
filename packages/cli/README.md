# forkstack

The CLI of [forkstack](https://forkstack.dev), for stacked pull requests from a fork to its upstream repository.

It needs the [GitHub CLI](https://cli.github.com). Sign in with `gh auth login`, and sign in on [forkstack.dev](https://forkstack.dev) once.

```bash
npm install -g forkstack
```

Or install it as a GitHub CLI extension, which needs no Node.js, and run it as `gh forkstack`:

```bash
gh extension install liangmiQwQ/gh-forkstack
```

| Command                                          | What it does                                                                            |
| ------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `forkstack submit`                               | Push every branch of the stack to your fork, open their upstream PRs and link the stack |
| `forkstack view`                                 | Show the stack with each PR's state, checks and review                                  |
| `forkstack checkout <pr-url \| pr-number \| id>` | Fetch every branch of a stack and check out the top one                                 |
| `forkstack rebase [--continue \| --abort]`       | Rebase the stack onto the latest trunk locally, then force-push it                      |
| `forkstack unstack`                              | Unlink the stack. Its PRs stay open                                                     |
| `forkstack up`, `down`, `top`, `bottom`, `trunk` | Move around the stack                                                                   |
| `forkstack switch`                               | Pick a branch of the stack to check out                                                 |

The stack is read from git: each branch builds on the one below it. Nothing is stored locally.

Your fork is the `origin` remote, and the upstream repository is the `upstream` remote, or your fork's parent on GitHub. Pass `--fork <remote>` or `--upstream <remote>` to use other remotes.

See the [docs](https://forkstack.dev/docs) for more.
