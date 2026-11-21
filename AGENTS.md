# forkstack Agent Guide

forkstack manages stacked pull requests across GitHub forks, for contributors whose stacks span their fork and the upstream repository.

## Toolchain

Vite+ is used as the project manager and dev toolchain for JavaScript part. Check `node_modules/vite-plus/docs` if you don't know how to use Vite+ features. When you find yourself needing a dev tool a tool is missing, you can check Vite+'s document first.

The web app is built with [Void](https://void.cloud) and React. Before working with Void, read the relevant docs in `packages/app/node_modules/void/docs/`, starting with `guide/quickstart.md` and `reference/cli.md`. Don't edit the generated `.void/` directory.

## Project Layout

All workspace packages live under `packages/`.

- `packages/app` contains the Void + React web app. Pages live in `pages/` and shared logic in `src/`.

## Rules

For visual design decisions, use [design.md](./design.md) as the starting point.

Keep JavaScript dependency versions in the default catalog in `pnpm-workspace.yaml`, and reference them with `catalog:` in package manifests.

As a opensource project, not all contributors are required to install Vite+ as `vp` globally, so when you are adding a script / task, using `package.json#scripts` to ensure the accessiblility for external contributors.

If you find AGENTS.md is outdated, please notice users to change in response.

Keep code functional. Write simple code that junior developers can understand, and make functions reusable if possible. Use Unix philosophy to design your code (Every function should only do one thing and should not be too long or complex).

Use existing dependencies and tools. Feel free to add dependencies. Don't reinvent the wheel.

Commit messages and PR titles follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).

Add `.gitkeep` file when creating new empty directory.
