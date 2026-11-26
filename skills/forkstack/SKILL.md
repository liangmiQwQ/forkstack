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

- **The branches are pushed to the repository the PRs merge into:** use GitHub's own stacked PRs with `gh stack`. Read [references/gh-stack.md](references/gh-stack.md).
- **The branches are pushed to a fork, and the PRs go to its upstream repository:** use forkstack, since GitHub's stacks don't work across forks. Read [references/forkstack.md](references/forkstack.md).
- **A PR's comments mention forkstack:** the stack is managed by forkstack. Read [references/forkstack.md](references/forkstack.md).
