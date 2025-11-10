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

Combine multiple validations in a single workflow for a unified experience:

```yaml
name: PR Validation

on:
  pull_request_target:
    types: [opened, reopened, synchronize]

permissions:
  contents: read
  pull-requests: write

jobs:
  validate-pr:
    runs-on: ubuntu-latest
    
    steps:
    # Path validation (uses GitHub API - no checkout needed)
    - name: Validate PR Paths
      uses: linonetwo/Cerebrus@feat/check-release-note
      with:
        pr_number: ${{ github.event.pull_request.number }}
        repo: ${{ github.repository }}
        base_ref: ${{ github.event.pull_request.base.ref }}
        github_token: ${{ secrets.GITHUB_TOKEN }}
        mode: rules
      continue-on-error: true
    
    # Change note validation (uses GitHub API - no checkout needed)
    - name: Validate Change Notes
      uses: linonetwo/Cerebrus@feat/check-release-note
      with:
        pr_number: ${{ github.event.pull_request.number }}
        repo: ${{ github.repository }}
        base_ref: ${{ github.event.pull_request.base.ref }}
        github_token: ${{ secrets.GITHUB_TOKEN }}
        mode: changenotes
      continue-on-error: true
    
    # Optional: Checkout for build size calculation
    - name: Check if core files changed
      id: core-changed
      uses: dorny/paths-filter@v2
      with:
        filters: |
          core:
            - 'boot/**'
            - 'core/**'
            - 'themes/tiddlywiki/snowwhite/**'
            - 'themes/tiddlywiki/vanilla/**'
    
    - name: Checkout repository (only for build size)
      if: steps.core-changed.outputs.core == 'true'
      uses: actions/checkout@v4
      with:
        ref: ${{ github.event.pull_request.head.sha }}
        fetch-depth: 0
    
    - name: Calculate Build Size
      if: steps.core-changed.outputs.core == 'true'
      id: build-size
      uses: linonetwo/Cerebrus@feat/check-release-note
      with:
        pr_number: ${{ github.event.pull_request.number }}
        repo: ${{ github.repository }}
        base_ref: ${{ github.event.pull_request.base.ref }}
        github_token: ${{ secrets.GITHUB_TOKEN }}
        mode: size:calc
      continue-on-error: true
    
    - name: Report Build Size
      if: steps.core-changed.outputs.core == 'true'
      uses: linonetwo/Cerebrus@feat/check-release-note
      with:
        pr_number: ${{ github.event.pull_request.number }}
        repo: ${{ github.repository }}
        base_ref: ${{ github.event.pull_request.base.ref }}
        github_token: ${{ secrets.GITHUB_TOKEN }}
        mode: size:comment
        pr_size: ${{ steps.build-size.outputs.pr_size }}
        base_size: ${{ steps.build-size.outputs.base_size }}
      continue-on-error: true
```

**Benefits**:

- ✅ Single PR comment with all validation results
- ✅ No race conditions between validations
- ✅ Clear execution order
- ✅ Modular and maintainable

**Available modes**:

- `rules` - Path validation (uses GitHub API, no checkout required)
- `changenotes` - Change note validation (uses GitHub API, no checkout required)
- `size:calc` - Build size calculation (requires checkout)
- `size:comment` - Build size reporting

**Note**: Both `rules` and `changenotes` modes work entirely through the GitHub API, making them fast and eliminating the need for repository checkout. They can also be easily tested locally using the CLI.

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
