/**
 * This script validates pull requests based on specific conditions:
 * - If the PR targets the 'tiddlywiki-com' branch, it ensures all files are inside the '/editions' folder.
 * - If the PR targets the 'master' branch, it checks if the PR only modifies documentation within the '/editions' folder.
 * 
 * Environment variables or action inputs needed:
 * - `GITHUB_TOKEN` (GitHub Actions only): GitHub token to authenticate with GitHub's REST API.
 * - `GITHUB_PERSONAL_ACCESS_TOKEN` (for local/standalone execution): Personal access token for GitHub API.
 * - `PR_NUMBER`: The pull request number to validate.
 * - `REPO`: The repository in the format "owner/repo".
 * - `BASE_REF`: The base branch of the pull request.
 * - `DRY_RUN`: Optional. If set to "true", will only log the results instead of posting comments.
 *
 * @example
 * // Running the script outside of GitHub Actions
 * // 1. Create a .env file with the following content:
 * //    GITHUB_PERSONAL_ACCESS_TOKEN=your_personal_access_token_here
 * //    PR_NUMBER=42
 * //    REPO=my-user/my-repo
 * //    BASE_REF=tiddlywiki-com
 * //    DRY_RUN=true
 * 
 * // 2. Run the script in your terminal:
 * node validate-pr.js
 */

const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';
const dryRun = process.env.DRY_RUN === 'true';
const CerebrusIdentifierComment = "<!-- Cerebrus PR report -->";

const path = require('path');
const PRCommentUtils = require(path.resolve(__dirname, 'pr-comment-utils'));
const rules = require('./rules');

async function run() {
	let octokit;
	let core;

	try {
		let prNumber, repo, baseRef;

		if(isGitHubActions) {
			core = require('@actions/core');
			const github = require('@actions/github');
			octokit = github.getOctokit(core.getInput('github_token'));
			prNumber = parseInt(core.getInput('pr_number'), 10);
			repo = core.getInput('repo');
			baseRef = core.getInput('base_ref');
		} else {
			const { Octokit } = await import('@octokit/rest');
			const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
			if(!token || !process.env.PR_NUMBER || !process.env.REPO || !process.env.BASE_REF) {
				console.error("❌ Missing required environment variables.");
				process.exit(1);
			}
			octokit = new Octokit({ auth: token });
			prNumber = parseInt(process.env.PR_NUMBER, 10);
			repo = process.env.REPO;
			baseRef = process.env.BASE_REF;
		}

		const [owner, repoName] = repo.split('/');
		const utils = new PRCommentUtils(octokit);
		const changedFiles = await utils.getChangedFiles(owner, repoName, prNumber);

		if(dryRun) {
			console.log(`ℹ️ [dry-run] Base branch: ${baseRef}`);
			console.log(`ℹ️ [dry-run] Changed files:\n- ${changedFiles.join('\n- ')}`);
		}

		/*
		if(changedFiles.length === 1 && changedFiles[0].startsWith("licenses/")) {
			return;
		}
		*/

		let messages = [];

		function processRule(rule, baseRef, changedFiles) {
			const matched = rule.condition(baseRef, changedFiles);
			if(dryRun) {
				console.log(`🔍 [dry-run] Processed rule: "${rule.name}" — matched: ${matched}`);
			}
			if(matched) {
				messages.push(`\n\n${rule.message}`);
				if(rule.stopProcessing) {
					return true;
				}
			}
			return false;
		};

		let abort = false;
		for(const rule of rules) {
			if(processRule(rule, baseRef, changedFiles)) {
				abort = true;
				break
			};
		}

		// delete the comment if one already exists
		const existing = await utils.getExistingComment(owner, repoName, prNumber, CerebrusIdentifierComment);
		if(existing && !dryRun) {
			await utils.deleteComment(owner, repoName, prNumber, existing.id);
		}

		if(messages.length && !abort) {
			messages.unshift(CerebrusIdentifierComment);
			if(dryRun) {
				console.log(`💬 [dry-run] Would post comment:\n${messages.join("\n")}`);
			} else {
				await utils.postComment(owner, repoName, prNumber, messages.join("\n"));
			}
		}
		
	} catch (err) {
		if (core) {
			core.setFailed(`Action failed: ${err.message}`);
		} else {
			console.error(`Validation failed: ${err.message}`);
			process.exit(1);
		}
	}
}

run();
