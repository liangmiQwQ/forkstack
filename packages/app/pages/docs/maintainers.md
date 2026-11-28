---
title: For maintainers
description: How to review, merge and rebase a stack of pull requests from a fork.
---

# For maintainers

A stack from a fork is a chain of pull requests that build on each other. You review and merge them on GitHub. You don't install forkstack, and the repository needs no extra setup.

Every PR in the stack targets the base branch, usually `main`. GitHub doesn't know they are ordered, so merging one also merges every open PR below it.

## Why the order matters

For a stack of three open PRs:

| PR         | Its own change | GitHub's diff shows | Merging it also merges |
| ---------- | -------------- | ------------------- | ---------------------- |
| #1, bottom | A              | A                   | #1                     |
| #2         | B              | A + B               | #1 and #2              |
| #3, top    | C              | A + B + C           | #1, #2 and #3          |

GitHub won't warn you. The forkstack comment on the PR, and the stack page it links to, are what show the order.

## Merge from the bottom

Merge one PR at a time, starting at the bottom open PR.

1. Merge the bottom open PR with whatever method the repository uses: squash, merge commit or rebase.
2. Leave the PRs above it. You don't rebase them by hand. Within a few minutes forkstack rebases them onto the base branch, so the next PR's diff shows only its own changes.
3. Wait for that diff before merging the next PR. Until the rebase finishes, the next PR still contains the one you just merged.

All three merge methods work. forkstack finds each later PR's own commits from the parent commits that PR still contains, then replays those commits. It does not depend on the merge commit, squash commit or rebased commits GitHub added to the base branch.

Don't merge a PR while an earlier one in the stack is still open. Don't close a PR in the middle. forkstack then can't tell where the rest of the stack should go, and the author has to fix the branches by hand.

## Read the comment and the stack page

The comment on a PR lists the stack with the top PR first and the base branch last, and marks the PR you're reading. It links to:

- **Review only this PR's changes**, a diff without the PRs below it.
- **View the stack**, the stack page.

The stack page is where the live state, checks and review of each PR are shown. The comment itself stays a list of the PRs and those two links.

When you review, use the review link, and leave comments about a lower PR on that PR. They get fixed there and reach this PR on the next rebase.

## Rebase

After the bottom PR merges, forkstack rebases the rest on its own. A stack can also need a rebase before that, for example after `main` has moved and the checks are failing, or after the author changed a lower PR.

The author can rebase it from the stack page, or with `forkstack rebase` on their machine.

You can start the same rebase from the stack page, after signing in to forkstack with GitHub, when both are true:

- You have write access to the upstream repository.
- Every open PR in the stack has "Allow edits by maintainers" on. GitHub doesn't offer it on forks owned by an organization, so those stacks stay with the author.

forkstack's GitHub App on the author's fork then replays the commits and force-pushes the branches, as it does when the author clicks. Your GitHub sign-in is only used to check your access, never to push. Otherwise, ask the author to rebase.
