---
title: Why forkstack
description: Why contributors working from a fork need their own way to stack pull requests.
---

# Why forkstack

## Large PRs are hard to review

A large change in one PR is slow to review. Reviewers have to hold every part of it in their head at once, a small question blocks the whole change, and the PR goes stale while `main` moves on.

A stack splits the change into steps, such as a refactor and then the feature that uses it. Each step is its own PR, so reviewers read one idea at a time, and the bottom steps can merge while the top ones are still being discussed.

## GitHub's stacks stop at the fork

[GitHub's stacked PRs](https://docs.github.com/en/pull-requests/get-started/about-stacked-prs) need every branch in the same repository, since each PR targets the branch below it. That works for maintainers, who can push to the upstream repository.

Most open source contributors can't. Their branches live in a fork, and a PR from a fork can only target a branch of the upstream repository. Without forkstack, they're left with:

- **One large PR**, with all the review problems above.
- **One PR at a time**, waiting for each step to merge before opening the next. The contributor is blocked, and reviewers never see where the change is going.
- **Separate PRs that all target `main`**. Each PR's diff also contains every PR below it, nothing tells reviewers the order, and after each merge the contributor rebases and force-pushes the rest by hand.

## What forkstack adds

forkstack keeps the last approach, where every PR targets `main`, and fixes what's missing:

- **The order is visible.** Every PR in the stack gets a comment listing the stack bottom to top, with the live state, checks and review of each PR.
- **Each PR reviews on its own.** The comment links to a diff with only the changes that PR adds.
- **Merges don't need cleanup.** After the bottom PR merges, forkstack rebases the rest of the stack onto `main`, so the next PR is ready to merge.
- **Contributors keep using git.** The stack is just branches built on top of each other. `forkstack submit` pushes them, opens the PRs and links them.

## Nothing to install upstream

forkstack doesn't need write access or any setup in the upstream repository. Maintainers review and merge as they always do, with any merge method. Only the contributor sets it up, on their own fork.

If you can push branches to the upstream repository, you don't need forkstack. Use GitHub's own stacked PRs with `gh stack` instead.
