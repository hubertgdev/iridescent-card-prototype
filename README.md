# my-app

> Replace this description with a short summary of what this project does.

## Stack

| Tool | Role |
|---|---|
| [Vite](https://vite.dev) | Dev server & bundler |
| [TypeScript](https://www.typescriptlang.org) | Language |
| [Tailwind CSS v4](https://tailwindcss.com) | Styling |
| [Biome](https://biomejs.dev) | Linter & formatter |
| [Vitest](https://vitest.dev) | Unit testing (jsdom) |
| [Husky](https://typicode.github.io/husky) + [lint-staged](https://github.com/lint-staged/lint-staged) | Pre-commit hook |
| [commitlint](https://commitlint.js.org) | Commit message linting |
| [semantic-release](https://semantic-release.gitbook.io) | Automated versioning & changelog |
| GitHub Actions | CI, releases, and deployment |
| [Cloudflare Pages](https://pages.cloudflare.com) | Hosting |

## Prerequisites

- **Node.js ≥ 24** (the exact version is pinned in `.nvmrc` — use `nvm use` if you have nvm)
- **npm** (comes with Node)

## Install

```bash
npm install
```

## Development

### Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the Vite dev server at `http://localhost:5173` |
| `npm run build` | Type-check + production build → `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run verify` | TypeScript type check only (no output files) |
| `npm run check` | Biome lint & format check (dry run) |
| `npm run fix` | Biome lint & format with auto-fix |
| `npm test` | Run tests in watch mode via Vitest |
| `npm run coverage` | Single test run with coverage report |

### Linting & formatting

[Biome](https://biomejs.dev) handles both linting and formatting in one tool. The pre-commit hook runs `lint-staged`, which automatically runs `biome check --write` on every staged `.js`, `.ts`, `.json`, `.css`, etc. file before a commit goes through.

### Testing

Tests live in `src/tests/`. The environment is `jsdom`, so DOM APIs are available.

### Path alias

`@` is aliased to `./src`:

```ts
import { something } from '@/utils/something'
```

### App version

The current `package.json` version is exposed at runtime as the global `__APP_VERSION__` (a `string`), injected by Vite at build time:

```ts
console.log(__APP_VERSION__) // e.g. "1.3.0"
```

## Commit conventions

This project enforces [Conventional Commits](https://www.conventionalcommits.org) via `commitlint`. The `commit-msg` Git hook rejects any message that doesn't follow the format:

```
<type>(<optional scope>): <short description>
```

Common types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `perf`, `ci`.

> **Why this matters:** `semantic-release` reads the commit history to determine the next version number and generate the changelog. A `feat` triggers a minor bump, a `fix` triggers a patch, and a `BREAKING CHANGE` footer triggers a major bump.

## CI/CD

The GitHub Actions workflow (`.github/workflows/ci.yml`) has two jobs.

**`check`** — runs on every push and pull request to `dev`, `develop`, `main`, or `master`:

1. `npm run check` — Biome lint & format check
2. `npm run verify` — TypeScript type check
3. `npm test` — Vitest test suite
4. `npm run build` — production build

**`release-deploy`** — runs on push to `main` / `master` only, after `check` passes:

1. Runs `semantic-release` to bump the version, update `CHANGELOG.md`, and create a GitHub Release.
2. Rebuilds the app so the injected version matches the new release.
3. Deploys to Cloudflare Pages.
