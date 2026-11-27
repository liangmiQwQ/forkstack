---
name: forkstack
description: Split work into stacked pull requests, where each branch builds on the one below it and becomes its own PR. Use when a change is too large for one PR, when the user asks for stacked PRs, or when a PR's comments mention forkstack. Covers GitHub's `gh stack` for branches in the upstream repository, and the `forkstack` CLI for branches in a fork.
---

# Stacked pull requests

A stack is a chain of branches on top of a trunk (usually `main`). Each branch builds on the one below it, becomes its own PR, and merges bottom to top. Stack a change when it splits into steps that can be reviewed one at a time, such as a refactor, then the feature that uses it.

## Keep the history linear

Each branch should contain the branch below it, plus only its own commits, in a straight line. When a lower branch changes, start there and replay each branch above it. Don't merge the lower branch into the one above.

For a stack `main → A → B → C`, a new commit on A is brought up like this:

1. Replay only B's own commits onto the new A.
2. Replay only C's own commits onto the new B.

Don't run `git merge A` while B is checked out. Resolving that merge can record edits that exist only in the merge commit, and those edits can disappear when the stack is flattened later.

The rebase command does this replay. Run it from the branch that changed, or from anywhere in the stack:

- **gh stack:** `gh stack rebase --upstack`, then `gh stack push`. `gh stack rebase` does the whole stack, from the trunk upward.
- **forkstack:** `forkstack rebase`, then `forkstack submit`.

This is how you update open branches. Landing the PRs is a separate step, covered in the [maintainers guide](https://forkstack.dev/docs/maintainers).

## Pick the tool

Check where the branches will be pushed:

```sh
git remote -v
gh repo view --json isFork,parent
```

- **The branches are pushed to the repository the PRs merge into:** use GitHub's own stacked PRs with `gh stack`. Read [references/gh-stack.md](references/gh-stack.md).
- **The branches are pushed to a fork, and the PRs go to its upstream repository:** use forkstack, since GitHub's stacks don't work across forks. Read [references/forkstack.md](references/forkstack.md).
- **A PR's comments mention forkstack:** the stack is managed by forkstack. Read [references/forkstack.md](references/forkstack.md).
