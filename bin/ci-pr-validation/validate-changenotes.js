import PRCommentUtils from './pr-comment-utils.js';
import { checkNeedsChangeNote, validateChangeNotes as validateNotes, parseChangeNotes as parseNotes } from './changenote.js';
import fs from 'fs';
import path from 'path';

const CEREBRUS_IDENTIFIER = "<!-- Cerebrus PR report -->";
const CHANGENOTE_SECTION_START = "<!-- Change Note Section -->";
const CHANGENOTE_SECTION_END = "<!-- End Change Note Section -->";

// Parse tiddler file helper
function parseTiddlerFile(filePath, repoPath) {
	const fullPath = path.join(repoPath, filePath);
	
	if (!fs.existsSync(fullPath)) {
		return null;
	}
	
	const content = fs.readFileSync(fullPath, "utf-8");
	const lines = content.split("\n");
	const fields = {};
	let bodyStartIndex = -1;
	
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		
		if (line.trim() === "") {
			bodyStartIndex = i + 1;
			break;
		}
		
		const match = line.match(/^([^:]+):\s*(.*)$/);
		if (match) {
			fields[match[1]] = match[2];
		}
	}
	
	if (bodyStartIndex !== -1) {
		fields.text = lines.slice(bodyStartIndex).join("\n").trim();
	}
	
	return fields;
}

// Helper function to replace or append section in existing comment
function replaceOrAppendSection(existingBody, newSection) {
	// Check if change note section already exists
	const sectionRegex = new RegExp(`${CHANGENOTE_SECTION_START}[\\s\\S]*?${CHANGENOTE_SECTION_END}`, 'g');
	
	if (sectionRegex.test(existingBody)) {
		// Replace existing section
		return existingBody.replace(sectionRegex, newSection);
	} else {
		// Append new section
		return `${existingBody}\n\n${newSection}`;
	}
}

export default async function validateChangeNotes(context, octokit, dryRun) {
	const { owner, repoName, prNumber } = context;
	
	console.log('📝 Validating change notes...');
	
	// Get current working directory (should be TiddlyWiki5 root)
	const repoPath = process.cwd();
	console.log(`Working directory: ${repoPath}`);
	
	const utils = new PRCommentUtils(octokit);
	
	try {
		// Get all changed files in the PR
		const { data: files } = await octokit.pulls.listFiles({
			owner,
			repo: repoName,
			pull_number: prNumber,
			per_page: 100,
		});
		
		const allFiles = files.map(f => f.filename);
		const releaseNotesFiles = allFiles.filter(f => 
			f.match(/editions\/.*\/tiddlers\/releasenotes\/.*\.tid$/)
		);
		
		console.log(`Found ${allFiles.length} changed files, ${releaseNotesFiles.length} in releasenotes/`);
		
		// Check if PR needs change notes
		const needsChangeNote = checkNeedsChangeNote(allFiles);
		const hasChangeNotes = releaseNotesFiles.length > 0;
		
		let commentBody = '';
		let validationPassed = true;
		
		if (hasChangeNotes) {
			// Validate change note format
			const validation = validateNotes(releaseNotesFiles, repoPath);
			
			if (validation.success) {
				if (needsChangeNote) {
					// Parse and display change notes
					const summaries = parseNotes(releaseNotesFiles, repoPath);
					commentBody = generateSuccessComment(summaries);
				} else {
					// Doc only changes with releasenotes files
					commentBody = generateDocOnlyWithNotesComment();
				}
			} else {
				// Check if we found any actual notes
				const hasActualNotes = releaseNotesFiles.some(f => {
					const fields = parseTiddlerFile(f, repoPath);
					return fields && (fields.tags?.includes('$:/tags/ChangeNote') || fields.tags?.includes('$:/tags/ImpactNote'));
				});
				
				if (!hasActualNotes && needsChangeNote) {
					commentBody = generateMissingNotesComment();
					validationPassed = false;
				} else if (!hasActualNotes) {
					commentBody = generateDocOnlyWithNotesComment();
				} else {
					// Validation failed
					commentBody = generateValidationFailedComment(validation.errors);
					validationPassed = false;
				}
			}
		} else {
			// No release notes files
			if (needsChangeNote) {
				commentBody = generateMissingChangeNoteComment();
				validationPassed = false;
			} else {
				commentBody = generateDocOnlyComment();
			}
		}
		
		// Post or update comment to PR
		if (!dryRun) {
			// Wrap content in section markers
			const sectionedContent = `${CHANGENOTE_SECTION_START}\n\n${commentBody}\n\n${CHANGENOTE_SECTION_END}`;
			
			// Check if there's an existing Cerebrus comment
			const existingComment = await utils.getExistingComment(owner, repoName, prNumber, CEREBRUS_IDENTIFIER);
			
			if (existingComment) {
				// Update existing comment, replacing the change note section
				const updatedBody = replaceOrAppendSection(existingComment.body, sectionedContent);
				await utils.updateComment(owner, repoName, prNumber, existingComment.id, updatedBody);
			} else {
				// Create new comment with Cerebrus identifier
				const fullComment = `${CEREBRUS_IDENTIFIER}\n\n${sectionedContent}`;
				await utils.postComment(owner, repoName, prNumber, fullComment);
			}
		} else {
			console.log('Dry run - would post/update comment:');
			console.log(commentBody);
		}
		
		if (!validationPassed) {
			throw new Error('Change note validation failed');
		}
		
		return { success: validationPassed };
		
	} catch (error) {
		console.error('❌ Change note validation error:', error.message);
		throw error;
	}
}

function generateSuccessComment(summaries) {
	return `## ✅ Change Note Status

All change notes are properly formatted and validated!

${summaries}

<details>
<summary>📖 Change Note Guidelines</summary>

Change notes help track and communicate changes effectively. See the [full documentation](https://tiddlywiki.com/prerelease/#Release%20Notes%20and%20Changes) for details.

</details>`;
}

function generateValidationFailedComment(errors) {
	let errorText = '';
	
	for (const { file, issues } of errors) {
		errorText += `### 📄 \`${file}\`\n\n`;
		for (const issue of issues) {
			errorText += `- ${issue}\n`;
		}
		errorText += "\n";
	}
	
	return `## ❌ Change Note Status

Change note validation failed. Please fix the following issues:

${errorText}

---

📚 **Documentation**: [Release Notes and Changes](https://tiddlywiki.com/prerelease/#Release%20Notes%20and%20Changes)`;
}

function generateMissingChangeNoteComment() {
	return `## ⚠️ Change Note Status

This PR appears to contain code changes but doesn't include a change note.

Please add a change note by creating a \`.tid\` file in \`editions/tw5.com/tiddlers/releasenotes/<version>/\`

📚 **Documentation**: [Release Notes and Changes](https://tiddlywiki.com/prerelease/#Release%20Notes%20and%20Changes)

💡 **Note**: If this is a documentation-only change, you can ignore this message.`;
}

function generateMissingNotesComment() {
	return `## ⚠️ Change Note Status

This PR appears to contain code changes and modified files in the \`releasenotes/\` directory, but no valid Change Notes or Impact Notes were found.

Please ensure you've added proper change notes with the required tags (\`$:/tags/ChangeNote\` or \`$:/tags/ImpactNote\`).

📚 **Documentation**: [Release Notes and Changes](https://tiddlywiki.com/prerelease/#Release%20Notes%20and%20Changes)

Note: If this is a documentation-only change or doesn't require a change note, you can ignore this message.`;
}

function generateDocOnlyComment() {
	return `## ✅ Change Note Status

This PR contains documentation or configuration changes that typically don't require a change note.`;
}

function generateDocOnlyWithNotesComment() {
	return `## ✅ Change Note Status

This PR contains documentation or configuration changes (including changes to release notes documentation) that typically don't require a change note.`;
}
