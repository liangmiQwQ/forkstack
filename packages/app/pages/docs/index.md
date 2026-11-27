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

You don't need to install anything. The comment on each PR lists the stack and links to a diff of only that PR's changes. The stack page shows the live state, checks and review of each PR.

Use that diff when you review, and leave comments about a lower PR on that PR. Merge from the bottom, one PR at a time, and wait for forkstack to rebase the rest onto `main` before merging the next. The [maintainers guide](/docs/maintainers) has the full steps, including which merge methods work and what breaks a stack.

## For contributors

Build the stack as branches in your fork, then let forkstack open the PRs and link them. See [Contributing with forkstack](/docs/contributing).

If you can push branches to the upstream repository, use GitHub's own stacked PRs with `gh stack` instead.
