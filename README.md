# Cerebrus: PR Validation Action :dog:

This GitHub Action validates pull requests to ensure they meet specific conditions for file paths based on the target branch. It works for both GitHub Actions workflows and local/standalone execution.

## 🔧 Features

- ✅ Path validation rules tied to target branches
  - Enforcing that PRs targeting `tiddlywiki-com` only touch files under `/editions`
  - Warning when PRs targeting `master` only contain documentation changes in `/editions`
- 🔁 Posts informative comments directly on the PR
- 🖥️ Usable both in GitHub Actions and as a standalone CLI tool
- 🔐 Uses either the GitHub Actions token or a Personal Access Token

## 📦 Usage in Workflows

Add this action to your workflow:

```yaml
name: Validate PR Paths

on:
  pull_request:
    types: [opened, reopened, synchronize]

jobs:
  validate-pr:
    runs-on: ubuntu-latest

    steps:
    - name: Validate PR
      uses: TiddlyWiki/cerebrus@v1
      with:
        pr_number: ${{ github.event.pull_request.number }}
        repo: ${{ github.repository }}
        base_ref: ${{ github.base_ref }}
        github_token: ${{ secrets.GITHUB_TOKEN }}
```

## ⚙️ Inputs

| Name          | Description                                       | Required |
|---------------|---------------------------------------------------|----------|
| `pr_number`   | The pull request number                           | ✅ Yes   |
| `repo`        | The repository in `owner/repo` format             | ✅ Yes   |
| `base_ref`    | The base branch of the PR (`tiddlywiki-com`, etc) | ✅ Yes   |
| `github_token`| secrets.GITHUB_TOKEN                              | ✅ Yes   |

## 🔐 Authentication
- When using **locally or via CLI**, use `GITHUB_PERSONAL_ACCESS_TOKEN`

## 🖥️ Local CLI Usage

Install dependencies:

```bash
npm install
export GITHUB_PERSONAL_ACCESS_TOKEN=ghp_yourTokenHere
node bin/ci-pr-validation/run-validate-branch.js --pr 123 --repo yourname/yourrepo
```

## 🔄 Release & Versioning

```bash
git tag v1
git push origin v1
```

## 📄 License

MIT
