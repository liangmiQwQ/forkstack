---
name: forkstack
description: Split work into stacked pull requests, where each branch builds on the one below it and becomes its own PR. Use when a change is too large for one PR, when the user asks for stacked PRs, or when a PR's comments mention forkstack. Covers GitHub's `gh stack` for branches in the upstream repository, and the `forkstack` CLI for branches in a fork.
---

# Stacked pull requests

A stack is a chain of branches on top of a trunk (usually `main`). Each branch builds on the one below it, becomes its own PR, and merges bottom to top. Stack a change when it splits into steps that can be reviewed one at a time, such as a refactor, then the feature that uses it.

## Pick the tool

Check where the branches will be pushed:

```sh
git remote -v
gh repo view --json isFork,parent
```

- **The branches are pushed to the repository the PRs merge into:** use GitHub's own stacked PRs with `gh stack`. Install it with `gh extension install github/gh-stack`, then see `gh stack --help`.
- **The branches are pushed to a fork, and the PRs go to its upstream repository:** use forkstack. GitHub's stacks don't work across forks.

The rest of this skill covers forkstack.

## Set up forkstack

1. Check that `gh auth status` succeeds. If it doesn't, ask the user to run `gh auth login`.
2. Install the CLI if `forkstack` and `gh forkstack` are both missing: `gh extension install liangmiQwQ/gh-forkstack`, or `npm install -g forkstack`. Ask the user before installing.
3. The user must sign in on https://forkstack.dev once. If a command fails asking for that, tell the user. You can't do it for them.

forkstack expects the fork as the `origin` remote, and the upstream repository as `upstream`, or the fork's parent on GitHub. Pass `--fork <remote>` and `--upstream <remote>` when the remotes have other names.

## Build a stack

forkstack reads the stack from git, so a stack is just branches created on top of each other:

```sh
git switch -c refactor-parser main
# commit the first step
git switch -c parser-plugins
# commit the second step
forkstack submit
```

- Keep each branch one reviewable step. Commit each change to the branch it belongs to, not the top one.
- The first own commit of a branch becomes its PR's title and description, so write it as one.
- `forkstack submit` pushes every branch, opens the missing PRs, and links the stack. Run it again after any change. Add `--draft` for draft PRs.
- After changing a lower branch, run `forkstack rebase` to replay the branches above it, then `forkstack submit`.

## Commands

| Command                                          | Use                                                      |
| ------------------------------------------------ | -------------------------------------------------------- |
| `forkstack view`                                 | See the stack, with each PR's state, checks and review   |
| `forkstack submit`                               | Push the stack, open PRs and link them                   |
| `forkstack rebase`                               | Rebase the stack onto the latest trunk and force-push it |
| `forkstack checkout <pr-url \| number \| id>`    | Fetch a stack and check out its top branch               |
| `forkstack up`, `down`, `top`, `bottom`, `trunk` | Move between branches                                    |
| `forkstack unstack`                              | Unlink the stack, leaving its PRs open                   |

Don't run `forkstack switch`. It asks for a choice interactively, so use `up`, `down`, `top` or `bottom` instead.

## Conflicts during rebase

When `forkstack rebase` stops at a conflict, resolve the files, `git add` them, and run `forkstack rebase --continue`. Don't run `git rebase --continue` yourself. If the conflict isn't yours to settle, run `forkstack rebase --abort`, which restores every branch, and ask the user.

## Working on someone's stack

forkstack posts a comment on every PR in a stack. Its hidden `forkstack-agent` note lists each PR's branch. When reviewing a PR above the bottom, review only its own commits (`<branch below>..<this branch>`), since GitHub's diff also contains the PRs below it.

When merging, merge the bottom PR first, then wait for forkstack to rebase the rest onto the trunk before merging the next. Never merge a PR above an open one, or close one in the middle.

More at https://forkstack.dev/docs.
