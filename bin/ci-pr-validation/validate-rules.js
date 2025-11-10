import path from 'path';
import { fileURLToPath } from 'url';
import PRCommentUtils from './pr-comment-utils.js';
import rules from './rules.js';

const CEREBRUS_IDENTIFIER = "<!-- Cerebrus PR report -->";
const PATH_VALIDATION_SECTION_START = "<!-- Path Validation Section -->";
const PATH_VALIDATION_SECTION_END = "<!-- End Path Validation Section -->";

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

	// Check if there's an existing Cerebrus comment
	const existing = await utils.getExistingComment(owner, repoName, prNumber, CEREBRUS_IDENTIFIER);

	if(messages.length && !abort) {
		const pathMessage = messages.join("\n");
		const sectionedMessage = `${PATH_VALIDATION_SECTION_START}\n${pathMessage}\n${PATH_VALIDATION_SECTION_END}`;
		
		if(dryRun) {
			console.log(`💬 [dry-run] Would post comment:\n${pathMessage}`);
		} else {
			if (existing) {
				// Update existing comment, replacing the path validation section
				const updatedBody = replaceOrAppendSection(existing.body, sectionedMessage);
				await utils.updateComment(owner, repoName, prNumber, existing.id, updatedBody);
			} else {
				// Create new comment with Cerebrus identifier
				const fullComment = `${CEREBRUS_IDENTIFIER}\n\n${sectionedMessage}`;
				await utils.postComment(owner, repoName, prNumber, fullComment);
			}
		}
	} else if (existing && !dryRun) {
		// Remove path validation section if no messages
		const updatedBody = removeSection(existing.body, PATH_VALIDATION_SECTION_START, PATH_VALIDATION_SECTION_END);
		if (updatedBody !== existing.body) {
			await utils.updateComment(owner, repoName, prNumber, existing.id, updatedBody);
		}
	}
}

// Helper function to replace or append section in existing comment
function replaceOrAppendSection(existingBody, newSection) {
	const sectionRegex = new RegExp(`${PATH_VALIDATION_SECTION_START}[\\s\\S]*?${PATH_VALIDATION_SECTION_END}`, 'g');
	
	if (sectionRegex.test(existingBody)) {
		return existingBody.replace(sectionRegex, newSection);
	} else {
		return `${existingBody}\n\n${newSection}`;
	}
}

// Helper function to remove section from existing comment
function removeSection(existingBody, sectionStart, sectionEnd) {
	const sectionRegex = new RegExp(`${sectionStart}[\\s\\S]*?${sectionEnd}\\n*`, 'g');
	return existingBody.replace(sectionRegex, '').trim();
}

export default applyRules;