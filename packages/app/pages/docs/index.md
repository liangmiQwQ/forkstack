---
title: Getting started
description: How stacked pull requests from a fork work, for maintainers, reviewers and contributors.
---

# Getting started

A stack is a chain of pull requests where each one builds on the one below it. A large change is split into steps, such as a refactor and then the feature that uses it, and each step is reviewed and merged on its own, bottom to top.

[GitHub's stacked PRs](https://docs.github.com/en/pull-requests/get-started/about-stacked-prs) need every branch in the same repository. forkstack brings stacks to contributors whose branches live in a fork.

## Why a stack from a fork looks different

A PR from a fork can only target a branch of the upstream repository, such as `main`. It can't target the contributor's branch below it, since that branch lives in the fork. So every PR in the stack targets `main`, and GitHub's diff of a PR also contains the changes of every PR below it.

For a stack of three PRs:

| PR         | Its own change | GitHub's diff shows |
| ---------- | -------------- | ------------------- |
| #1, bottom | A              | A                   |
| #2         | B              | A + B               |
| #3, top    | C              | A + B + C           |

## For reviewers and maintainers

You don't need to install anything. forkstack posts a comment on every PR in the stack, which:

- Lists the PRs in the stack, bottom to top, and marks the one you're on.
- Shows the live state, checks and review of each PR.
- Links to **Review only this PR's changes**, which opens GitHub's diff without the PRs below it.

When reviewing:

- Use the review link, so you only read the changes this PR adds.
- Leave comments about a lower PR's changes on that PR. They'll be fixed there, and reach this PR on the next rebase.

When merging:

- Merge from the bottom, one PR at a time. Any merge method works.
- After the bottom PR merges, forkstack rebases the rest of the stack onto `main` within a few minutes, so the next PR's diff only shows its own changes. Wait for that before merging the next one.
- Don't merge a PR above an open one, or close one in the middle. forkstack can't tell where the rest of the stack should go then, and the contributor has to fix it by hand.

## For contributors

Build the stack as branches in your fork, then let forkstack open the PRs and link them. See [Contributing with forkstack](/docs/contributing).

If you can push branches to the upstream repository, use GitHub's own stacked PRs with `gh stack` instead.
