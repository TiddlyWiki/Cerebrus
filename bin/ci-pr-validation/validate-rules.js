import path from 'path';
import { fileURLToPath } from 'url';
import PRCommentUtils from './pr-comment-utils.js';
import rules from './rules.js';
const CerebrusIdentifierComment = "<!-- Cerebrus PR report -->";

async function applyRules(context, octokit, dryRun) {
	const { prNumber, repo, baseRef, owner, repoName } = context;
	const utils = new PRCommentUtils(octokit);
	const changedFiles = await utils.getChangedFiles(owner, repoName, prNumber);

	if(dryRun) {
		console.log(`ℹ️ [dry-run] Base branch: ${baseRef}`);
		console.log(`ℹ️ [dry-run] Changed files:\n- ${changedFiles.join('\n- ')}`);
	}

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
}

export default applyRules;