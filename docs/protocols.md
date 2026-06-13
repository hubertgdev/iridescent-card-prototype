# TypeScript app protocols

This document list the operations to run, implementations to write and tools to use for specific cases that may happen during the development of an app made with [TypeScript](https://www.typescriptlang.org) and no frontend framework.

> The goal of this document is to be as exhaustive as possible, leaving no doubt when it comes to add/use something in a project. Please report any missing part or need for more details.

## CI/CD

### Deploy to GitHub Pages

1. **Enable GitHub Pages deployment on GitHub**
    - Your repository > Settings > Pages: under **Source**, select *GitHub Actions*
    - Your repository > Settings > Environments > github-pages: edit the branch name if needed, make sure it matches the branch you will use to deploy the app

2. **Write the workflow script**

Permissions must be at least:

```yml
contents: write
issues: write
pull-requests: write
pages: write
id-token: write
```

Steps:

```yml
# Handle GitHub Pages deployment.
- uses: actions/configure-pages@v5

# Build
- run: npm run build
  env:
    # Vite reads this to set the base path so assets resolve under
    # https://<user>.github.io/<repo>
    BASE_PATH: /${{ github.event.repository.name }}/

# SPA fallback: GitHub Pages serves 404.html for any unknown path,
# so we copy index.html to let the client-side router handle deep links.
- run: cp dist/index.html dist/404.html

- uses: actions/upload-pages-artifact@v5
  with:
    path: dist

- id: deployment
  uses: actions/deploy-pages@v5
```

Note the `BASE_PATH` environment variable. When exporting to GitHub Pages, the app will have the URL `https://<user-name>.github.io/<repository-name>`. In the CI, you should match this, so the app can use the correct base URL.

3. **User `BASE_PATH` in `vite.config.ts`**:

```ts
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
})
```

#### Full CI script example (Node + Vite)

```yml
name: CI/CD

on:
  push:
    branches:
      - main
      - master

jobs:
  check:
    name: Lint, types, tests & build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - uses: actions/setup-node@v6
        with:
          node-version: 24
          node-version-file: .nvmrc
          cache: npm

      - run: npm ci
      - run: npm run check
      - run: npm run verify
      - run: npm test
      - run: npm run build

  # This job runs only on push to `main` or `master`, uses `semantic-release`
  # to bump the package version, and deploy the app to Cloudflare Pages.
  release-deploy:
    name: Release & deploy
    needs: check
    if: >
      github.event_name == 'push'
      && (github.ref == 'refs/heads/main' || github.ref == 'refs/heads/master')
    runs-on: ubuntu-latest
    permissions:
      contents: write
      issues: write
      pull-requests: write
      pages: write
      id-token: write
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v6
        with:
          node-version: 24
          node-version-file: .nvmrc
          cache: npm

      - run: npm ci

      # Semantic release will bump the package version, so the app must be re-built after this call
      - run: npx semantic-release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - run: npm run build

      # Handle GitHub Pages deployment.
      - uses: actions/configure-pages@v5

      # Build
      - run: npm run build
        env:
          # Vite reads this to set the base path so assets resolve under
          # https://<user>.github.io/<repo>
          BASE_PATH: /${{ github.event.repository.name }}/

      # SPA fallback: GitHub Pages serves 404.html for any unknown path,
      # so we copy index.html to let the client-side router handle deep links.
      - run: cp dist/index.html dist/404.html

      - uses: actions/upload-pages-artifact@v5
        with:
          path: dist

      - id: deployment
        uses: actions/deploy-pages@v5
```