---
title: Contributing
description: Open a stack of PRs from your fork with the forkstack CLI.
---

# Contributing with forkstack

## Install

forkstack needs the [GitHub CLI](https://cli.github.com). Sign in to it first:

```sh
gh auth login
```

Install forkstack as a GitHub CLI extension, which needs no Node.js, and run it as `gh forkstack`:

```sh
gh extension install liangmiQwQ/gh-forkstack
```

Or install it from npm, and run it as `forkstack`:

```sh
npm install -g forkstack
```

Then sign in to forkstack once. It opens forkstack.dev in your browser, where you sign in with the same GitHub account as `gh` and install the forkstack GitHub App on your forks. forkstack keeps using the token of `gh`, so it stores nothing on your machine.

```sh
forkstack login
```

forkstack expects your fork as the `origin` remote, and the upstream repository as the `upstream` remote. Without an `upstream` remote, it uses your fork's parent on GitHub. Pass `--fork <remote>` or `--upstream <remote>` to any command to use other remotes.

## Build a stack

forkstack reads the stack from git: the branches between the trunk and the current branch, in order. Nothing is stored locally. Create each branch on top of the previous one, then submit from any branch in the stack:

```sh
git switch -c refactor-parser main
# commit the first step
git switch -c parser-plugins
# commit the second step, which builds on the first
forkstack submit
```

`submit` pushes every branch to your fork with `--force-with-lease`, so it never overwrites commits pushed from elsewhere. It opens an upstream PR for each branch that has none, titled and described by the branch's first own commit, then links the stack. Pass `--draft` to open new PRs as drafts.

Run `submit` again after adding a branch on top, or after changing any branch. `submit` refuses a single branch, unless it builds on the top PR of a stack you linked before, such as when the lower branches live on another machine.

## Keep it up to date

After changing a lower branch, or when `main` moves on, rebase the stack:

```sh
forkstack rebase
```

It rebases each branch onto the new head of the one below it, and the bottom open branch onto the latest trunk, then force-pushes the branches that differ from your fork. Branches whose PRs merged are skipped.

When a branch conflicts, resolve the conflicts, `git add` them, and run `forkstack rebase --continue`. Run `forkstack rebase --abort` to restore every branch as it was.

You don't need to rebase after a merge. When the bottom PR merges, forkstack rebases the rest on GitHub. You can also rebase from the [dashboard](/dashboard). Merged PRs stay in the stack, so its page and the comment on each PR keep showing the whole stack. Once every PR has merged, the comments drop their links to forkstack, and the stack moves to the history on your dashboard. forkstack forgets it 30 days later, and the comments stay on the PRs.

After forkstack rebases on GitHub, your local branches are behind. Bring them up to date:

```bash
forkstack sync
```

It pulls each branch from your fork and replays any commits you made locally on top. Then it rebases the stack like `forkstack rebase`, pushes the branches that differ from your fork, and deletes the branches whose PRs merged. When a branch conflicts while pulling, resolve it, run `git rebase --continue`, then run `forkstack sync` again.

## Signed commits

A rebase on GitHub writes new commits, which drops their signatures. To keep them Verified, open [Settings](/settings/signing) and generate a signing key, then add its public key to your GitHub account as a [GPG key](https://github.com/settings/gpg/new). forkstack signs every later rebase of your stacks with it, including one a maintainer starts or one after a merge. Each commit keeps its author, and you become its committer, with the email you picked for the key. GitHub only verifies the signature when that email is verified on your account.

Without a key, a rebase on GitHub stops when your stack has verified commits or the base branch requires signed commits. Add a key, or run `forkstack rebase`, which signs with your own git setup. Otherwise it goes ahead unsigned.

forkstack keeps the private key encrypted on its server and never shows it. Delete it in Settings at any time, and remove it on GitHub too.

## Commands

| Command                                          | What it does                                                                            |
| ------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `forkstack login`                                | Sign in to forkstack in the browser, once                                               |
| `forkstack submit`                               | Push every branch of the stack to your fork, open their upstream PRs and link the stack |
| `forkstack view`                                 | Show the stack with each PR's state, checks and review                                  |
| `forkstack checkout <pr-url \| pr-number \| id>` | Fetch every branch of a stack and check out the top one                                 |
| `forkstack rebase [--continue \| --abort]`       | Rebase the stack onto the latest trunk locally, then force-push it                      |
| `forkstack sync`                                 | Pull the stack from your fork, rebase local commits onto it, and push them              |
| `forkstack unstack`                              | Unlink the stack. Its PRs stay open                                                     |
| `forkstack up`, `down`, `top`, `bottom`, `trunk` | Move around the stack                                                                   |
| `forkstack switch`                               | Pick a branch of the stack to check out                                                 |

`checkout` creates or fast-forwards a local branch for each open PR in the stack. A local branch with commits that were never pushed is left as it is.
