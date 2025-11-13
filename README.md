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

Cerebrus uses multiple workflow files for different validation tasks, following GitHub security best practices.

### Workflow 1: Path and Change Note Validation

Create `.github/workflows/pr-path-validation.yml`:

```yaml
name: Validate PR Paths

on:
  pull_request_target:
    types: [opened, reopened, synchronize]

jobs:
  validate-pr:
    runs-on: ubuntu-latest

    steps:
    # Step 1: Validate PR paths
    - name: Validate PR Paths
      uses: TiddlyWiki/cerebrus@v6
      with:
        pr_number: ${{ github.event.pull_request.number }}
        repo: ${{ github.repository }}
        base_ref: ${{ github.base_ref }}
        github_token: ${{ secrets.GITHUB_TOKEN }}
        mode: rules
      continue-on-error: true
    
    # Step 2: Validate change notes
    - name: Validate Change Notes
      uses: TiddlyWiki/cerebrus@v6
      with:
        pr_number: ${{ github.event.pull_request.number }}
        repo: ${{ github.repository }}
        base_ref: ${{ github.base_ref }}
        github_token: ${{ secrets.GITHUB_TOKEN }}
        mode: changenotes
      continue-on-error: true
```

This workflow uses GitHub API only (no checkout needed) and posts both results to a single PR comment.

### Workflow 2: Calculate Build Size (Untrusted)

Create `.github/workflows/pr-check-build-size.yml`:

```yaml
name: Calculate PR build size

on:
  pull_request_target:
    types: [opened, reopened, synchronize]
    paths:
      - 'boot/**'
      - 'core/**'
      - 'themes/tiddlywiki/snowwhite/**'
      - 'themes/tiddlywiki/vanilla/**'

jobs:
  calculate-build-size:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: read
      contents: read
    outputs:
      pr_size: ${{ steps.get_sizes.outputs.pr_size }}
      base_size: ${{ steps.get_sizes.outputs.base_size }}
    steps:
    - name: build-size-check
      id: get_sizes
      uses: TiddlyWiki/cerebrus@v6
      with:
        pr_number: ${{ github.event.pull_request.number }}
        repo: ${{ github.repository }}
        base_ref: ${{ github.event.pull_request.base.ref }}
        github_token: ${{ secrets.GITHUB_TOKEN }}
        mode: size:calc

  dispatch-followup:
    needs: calculate-build-size
    runs-on: ubuntu-latest
    permissions:
      actions: write
      pull-requests: write
      contents: read
    steps:
    - name: Trigger follow-up workflow
      uses: actions/github-script@v6
      with:
        github-token: ${{ secrets.GITHUB_TOKEN }}
        script: |
          await github.rest.actions.createWorkflowDispatch({
            owner: context.repo.owner,
            repo: context.repo.repo,
            workflow_id: 'pr-comment-build-size.yml',
            ref: 'master',
            inputs: {
              pr_number: '${{ github.event.pull_request.number }}',
              base_ref: '${{ github.event.pull_request.base.ref }}',
              pr_size: '${{ needs.calculate-build-size.outputs.pr_size }}',
              base_size: '${{ needs.calculate-build-size.outputs.base_size }}'
            }
          });
```

### Workflow 3: Post Build Size Comment (Trusted)

Create `.github/workflows/pr-comment-build-size.yml`:

```yaml
name: Comment on PR build size (Trusted workflow)

on:
  workflow_dispatch:
    inputs:
      pr_number:
        required: true
        type: string
      base_ref:
        required: true
        type: string
      pr_size:
        required: true
        type: string
      base_size:
        required: true
        type: string

jobs:
  comment-on-pr:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
      contents: read

    steps:
    - name: Build and check size
      uses: TiddlyWiki/cerebrus@v6
      with:
        pr_number: ${{ inputs.pr_number }}
        repo: ${{ github.repository }}
        base_ref: ${{ inputs.base_ref }}
        github_token: ${{ secrets.GITHUB_TOKEN }}
        mode: size:comment
        pr_size: ${{ inputs.pr_size }}
        base_size: ${{ inputs.base_size }}
```

**Why three separate workflow files?**

1. **Security**: Build size calculation (Workflow 2) runs untrusted PR code and cannot have write permissions. Comment posting (Workflow 3) runs on trusted code (master branch) and can write comments.

2. **Efficiency**: Path and change note validation (Workflow 1) use only GitHub API, making them fast and not requiring repository checkout.

3. **Single Comment**: Despite using separate workflows, all three validations post to the same PR comment using Cerebrus's unified section system.

**Benefits**:

- ✅ Single PR comment with all validation results (unified section system)
- ✅ No checkout needed for path and change note validation (fast, API-based)
- ✅ Build size uses secure two-workflow pattern (follows GitHub best practices)
- ✅ Fully testable locally via CLI

**Available modes**:

- `rules` - Path validation (uses GitHub API, no checkout required)
- `changenotes` - Change note validation (uses GitHub API, no checkout required)
- `size:calc` - Build size calculation (checkouts and builds PR code in untrusted environment)
- `size:comment` - Build size reporting (posts results from trusted environment)

## 🔧 Configuration

### Change Note Validation Configuration

The valid values for change note fields are defined in your repository's `editions/tw5.com/tiddlers/releasenotes/ReleasesInfo.multids` file.

To add a new enum value, edit `ReleasesInfo.multids` in your repository and add entries following the pattern:

```multids
change-types/<new-type>/caption: New Type Name
categories/<new-category>/caption: New Category Name
impact-types/<new-impact>/caption: New Impact Type Name
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
