# Cerebrus: PR Validation Action :dog:

This GitHub Action validates pull requests to ensure they meet specific conditions for file paths based on the target branch. It works for both GitHub Actions workflows and local/standalone execution.

## 🔧 Features

- ✅ Path validation rules tied to target branches
  - Enforcing that PRs targeting `tiddlywiki-com` only touch files under `/editions`
  - Warning when PRs targeting `master` only contain documentation changes in `/editions`
  - Warning when PRs signing the CLA contain other files or target a branch other than `tiddlywiki-com`
  - Warning when PRs modify auto-generated files
- 📝 **Change Note Validation**
  - Validates that code changes include proper change notes
  - Checks change note format and required fields
  - Supports both Change Notes and Impact Notes
  - Auto-detects documentation-only changes
- 🔁 Posts informative comments directly on the PR
- 🖥️ Usable both in GitHub Actions and as a standalone CLI tool
- 🔐 Uses either the GitHub Actions token or a Personal Access Token

## 📦 Usage in Workflows

### Path Validation

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

### Change Note Validation

Validate that code changes include proper change notes:

```yaml
name: Validate Change Notes

on:
  pull_request_target:
    types: [opened, reopened, synchronize]

jobs:
  validate-changenotes:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout repository
      uses: actions/checkout@v4
      with:
        ref: ${{ github.base_ref }}
        fetch-depth: 0
    
    - name: Fetch PR branch
      run: |
        git fetch origin pull/${{ github.event.pull_request.number }}/head:pr-branch
    
    - name: Validate Change Notes
      uses: TiddlyWiki/cerebrus@v1
      with:
        pr_number: ${{ github.event.pull_request.number }}
        repo: ${{ github.repository }}
        base_ref: ${{ github.base_ref }}
        github_token: ${{ secrets.GITHUB_TOKEN }}
        mode: changenotes
```

## ⚙️ Inputs

| Name          | Description                                       | Required |
|---------------|---------------------------------------------------|----------|
| `pr_number`   | The pull request number                           | ✅ Yes   |
| `repo`        | The repository in `owner/repo` format             | ✅ Yes   |
| `base_ref`    | The base branch of the PR (`tiddlywiki-com`, etc) | ✅ Yes   |
| `github_token`| secrets.GITHUB_TOKEN                              | ✅ Yes   |

## 🔐 Authentication

```

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
