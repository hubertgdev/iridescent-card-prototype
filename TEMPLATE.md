# Template setup guide

> **Delete this file once you've completed the steps below.**

## 1. Create your repository

Click **Use this template** on GitHub to create a new repository, then clone it locally:

```bash
git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>
npm install
```

`npm install` also runs `husky` via the `prepare` script, which installs the Git hooks.

## 2. Rename the app

Replace `my-app` with your project name in:

- `package.json` → `"name"` field
- `README.md` → the title and description

Reset the version to a clean start if needed:

```json
"version": "0.0.0"
```

## 3. Set up Cloudflare Pages deployment

The CI workflow deploys to Cloudflare Pages on every push to `main` / `master`. To enable it, you need to add credentials to your GitHub repository.

### Add secrets and variables to GitHub

| Name | Type | Where to find |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Secret (repository) | `Cloudflare > Profile > API Tokens > Create token`
This token should at least enable the permission `Account > Cloudflare Pages: Edit` |
| `CLOUDFLARE_ACCOUNT_ID` | Secret (organization or repository) | `Cloudflare > Account’s “more” > Copy account ID` |
| `CLOUDFLARE_PAGES_PROJECT_NAME` | Variable (repository) | Name of the Cloudflare Pages project, as visible in `Account Dashboard > Build > Compute > Workers & Pages` (defaults to repository name) |

### Create the Pages project

The first deployment creates the project automatically — Wrangler will use your repository name as the project name. Alternatively, create it manually in the Cloudflare dashboard under **Pages → Create a project → Direct Upload** before the first push.

### Disabling Cloudflare Pages

If you don't need deployment for this project, remove the last two steps of the `release-deploy` job in `.github/workflows/ci.yml` (the `Check Cloudflare credentials` run and the `cloudflare/wrangler-action` step).
