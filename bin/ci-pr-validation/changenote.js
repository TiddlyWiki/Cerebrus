/**
 * TiddlyWiki Change Note Validation Module
 * Validates change notes and impact notes format
 */

import fs from 'fs';
import path from 'path';

// Configuration
const CONFIG = {
	skipPatterns: [
		/^\.github\//,
		/^\.vscode\//,
		/^\.editorconfig$/,
		/^\.gitignore$/,
		/^LICENSE$/,
		/\.md$/,
		/^bin\/.*\.md$/,
		/^playwright-report\//,
		/^test-results\//,
		/^editions\/.*-docs?\//,
		/^community\//,
		/\/releasenotes\//,
	],
	
	requiresChangeNote: [
		/\/(core|plugin\.info|modules)\//,
	],
	
	validation: {
		titlePattern: /^\$:\/changenotes\/[0-9]+\.[0-9]+\.[0-9]+\/(#[0-9]+|[a-f0-9]{40})$/,
		releasePattern: /^[0-9]+\.[0-9]+\.[0-9]+$/,
		impactTitlePattern: /^\$:\/changenotes\/[0-9]+\.[0-9]+\.[0-9]+\/.*\/impacts\/[a-z0-9-]+$/,
	},
	
	changeNoteFields: {
		title: {
			required: true,
			pattern: "titlePattern",
			errorMessage: "Title format: Expected `$:/changenotes/<version>/<#issue or commit-hash>`, found: `{value}`",
		},
		tags: {
			required: true,
			contains: "$:/tags/ChangeNote",
			errorMessage: "Tags: Must include `$:/tags/ChangeNote`, found: `{value}`",
		},
		"change-type": {
			required: true,
			validValues: "changeTypes",
			errorMessage: "Invalid change-type: `{value}` is not valid. Must be one of: `{validValues}`",
			missingMessage: "Missing field: `change-type` is required. Valid values: `{validValues}`",
		},
		"change-category": {
			required: true,
			validValues: "changeCategories",
			errorMessage: "Invalid change-category: `{value}` is not valid. Must be one of: `{validValues}`",
			missingMessage: "Missing field: `change-category` is required. Valid values: `{validValues}`",
		},
		description: {
			required: true,
			errorMessage: "Missing field: `description` is required",
		},
		release: {
			required: true,
			pattern: "releasePattern",
			errorMessage: "Invalid release format: Expected `X.Y.Z` format, found: `{value}`",
			missingMessage: "Missing field: `release` is required (e.g., `5.4.0`)",
		},
		"github-links": {
			required: true,
			errorMessage: "Missing field: `github-links` is required",
		},
		"github-contributors": {
			required: true,
			errorMessage: "Missing field: `github-contributors` is required",
		},
	},
	
	impactNoteFields: {
		title: {
			required: true,
			pattern: "impactTitlePattern",
			errorMessage: "Title format: Expected `$:/changenotes/<version>/<change-id>/impacts/<identifier>`, found: `{value}`",
		},
		tags: {
			required: true,
			contains: "$:/tags/ImpactNote",
			errorMessage: "Tags: Must include `$:/tags/ImpactNote`, found: `{value}`",
		},
		"impact-type": {
			required: true,
			validValues: "impactTypes",
			errorMessage: "Invalid impact-type: `{value}` is not valid. Must be one of: `{validValues}`",
			missingMessage: "Missing field: `impact-type` is required. Valid values: `{validValues}`",
		},
		changenote: {
			required: true,
			errorMessage: "Missing field: `changenote` is required (the title of the associated change note)",
		},
		description: {
			required: true,
			errorMessage: "Missing field: `description` is required",
		},
		created: {
			required: true,
			errorMessage: "Missing field: `created` is required (in DateFormat, e.g., `20250901000000000`)",
		},
		modified: {
			required: true,
			errorMessage: "Missing field: `modified` is required (in DateFormat, e.g., `20250901000000000`)",
		},
	},
	
	releasesInfoPatterns: {
		changeType: {
			caption: /^change-types\/([^/]+)\/caption:/,
		},
		category: {
			caption: /^categories\/([^/]+)\/caption:/,
		},
		impactType: {
			caption: /^impact-types\/([^/]+)\/caption:/,
		},
	},
};

// Load validation data from ReleasesInfo.multids
function loadReleasesInfo(repoPath) {
	const releasesInfoPath = path.join(repoPath, "editions", "tw5.com", "tiddlers", "releasenotes", "ReleasesInfo.multids");
	
	if (!fs.existsSync(releasesInfoPath)) {
		console.error(`Error: ReleasesInfo.multids not found at ${releasesInfoPath}`);
		throw new Error(`ReleasesInfo.multids not found at ${releasesInfoPath}`);
	}
	
	const content = fs.readFileSync(releasesInfoPath, "utf-8");
	const lines = content.split("\n");
	
	const changeTypes = new Set();
	const changeCategories = new Set();
	const impactTypes = new Set();
	
	const patterns = CONFIG.releasesInfoPatterns;
	
	for (const line of lines) {
		let match;
		
		match = line.match(patterns.changeType.caption);
		if (match) {
			changeTypes.add(match[1]);
		}
		
		match = line.match(patterns.category.caption);
		if (match) {
			changeCategories.add(match[1]);
		}
		
		match = line.match(patterns.impactType.caption);
		if (match) {
			impactTypes.add(match[1]);
		}
	}
	
	return {
		changeTypes: Array.from(changeTypes),
		changeCategories: Array.from(changeCategories),
		impactTypes: Array.from(impactTypes),
	};
}

// Parse tiddler file
function parseTiddlerFile(filePath, repoPath) {
	const fullPath = path.join(repoPath, filePath);
	
	if (!fs.existsSync(fullPath)) {
		return null;
	}
	
	const content = fs.readFileSync(fullPath, "utf-8");
	return parseTiddlerContent(content);
}

// Parse tiddler content from string (for API usage)
export function parseTiddlerContent(content) {
	if (!content) {
		return null;
	}
	
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

// Validate field
function validateField(fieldName, fieldValue, fieldConfig, fileErrors, releasesInfo) {
	if (fieldConfig.required && !fieldValue) {
		const message = fieldConfig.missingMessage || fieldConfig.errorMessage;
		const validValues = fieldConfig.validValues ? releasesInfo[fieldConfig.validValues] : null;
		fileErrors.push(interpolateMessage(message, {
			value: fieldValue,
			validValues: validValues ? validValues.join(", ") : "",
		}));
		return;
	}
	
	if (!fieldValue) {
		return;
	}
	
	if (fieldConfig.pattern) {
		const pattern = CONFIG.validation[fieldConfig.pattern];
		if (pattern && !pattern.test(fieldValue)) {
			fileErrors.push(interpolateMessage(fieldConfig.errorMessage, { value: fieldValue }));
			return;
		}
	}
	
	if (fieldConfig.contains && !fieldValue.includes(fieldConfig.contains)) {
		fileErrors.push(interpolateMessage(fieldConfig.errorMessage, { value: fieldValue }));
		return;
	}
	
	if (fieldConfig.validValues) {
		const validValues = releasesInfo[fieldConfig.validValues];
		if (validValues && !validValues.includes(fieldValue)) {
			fileErrors.push(interpolateMessage(fieldConfig.errorMessage, {
				value: fieldValue,
				validValues: validValues.join(", "),
			}));
		}
	}
}

function interpolateMessage(template, values) {
	return template.replace(/\{(\w+)\}/g, (match, key) => (values[key] !== undefined ? values[key] : match));
}

// Check if files need change notes
export function checkNeedsChangeNote(files) {
	for (const file of files) {
		// Skip files matching skipPatterns (includes releasenotes directory)
		if (CONFIG.skipPatterns.some(pattern => pattern.test(file))) {
			continue;
		}
		
		// Check if it's an editions tiddler file
		if (/^editions\/.*\/tiddlers\/.*\.tid$/.test(file)) {
			// If it requires a change note (e.g., contains core/modules), flag it
			if (CONFIG.requiresChangeNote.some(pattern => pattern.test(file))) {
				return true;
			}
			// Otherwise, editions tiddlers don't require change notes
			continue;
		}
		
		// All other files require change notes
		return true;
	}
	
	return false;
}

// Validate change notes
export function validateChangeNotes(files, repoPath = '.') {
	const releasesInfo = loadReleasesInfo(repoPath);
	const errors = [];
	
	for (const file of files) {
		if (!/editions\/.*\/tiddlers\/releasenotes\//.test(file)) {
			continue;
		}
		
		console.log(`Validating: ${file}`);
		
		const fields = parseTiddlerFile(file, repoPath);
		if (!fields) {
			errors.push({
				file,
				issues: ["File not found or cannot be read"],
			});
			continue;
		}
		
		const fileErrors = [];
		const tags = fields.tags || "";
		
		if (tags.includes("$:/tags/ChangeNote")) {
			validateChangeNote(fields, fileErrors, releasesInfo);
		} else if (tags.includes("$:/tags/ImpactNote")) {
			validateImpactNote(fields, fileErrors, releasesInfo);
		} else {
			console.log(`Skipping non-note file: ${file}`);
			continue;
		}
		
		if (fileErrors.length > 0) {
			errors.push({ file, issues: fileErrors });
		}
	}
	
	if (errors.length > 0) {
		return { success: false, errors };
	}
	
	return { success: true, errors: [] };
}

// Validate change notes from content map (for API usage)
export function validateChangeNotesFromContent(fileContents, releasesInfoContent) {
	const releasesInfo = parseReleasesInfoContent(releasesInfoContent);
	const errors = [];
	
	for (const [file, content] of Object.entries(fileContents)) {
		if (!/editions\/.*\/tiddlers\/releasenotes\//.test(file)) {
			continue;
		}
		
		console.log(`Validating: ${file}`);
		
		const fields = parseTiddlerContent(content);
		if (!fields) {
			errors.push({
				file,
				issues: ["File not found or cannot be read"],
			});
			continue;
		}
		
		const fileErrors = [];
		const tags = fields.tags || "";
		
		if (tags.includes("$:/tags/ChangeNote")) {
			validateChangeNote(fields, fileErrors, releasesInfo);
		} else if (tags.includes("$:/tags/ImpactNote")) {
			validateImpactNote(fields, fileErrors, releasesInfo);
		} else {
			console.log(`Skipping non-note file: ${file}`);
			continue;
		}
		
		if (fileErrors.length > 0) {
			errors.push({ file, issues: fileErrors });
		}
	}
	
	if (errors.length > 0) {
		return { success: false, errors };
	}
	
	return { success: true, errors: [] };
}

// Parse ReleasesInfo from content string (for API usage)
function parseReleasesInfoContent(content) {
	const lines = content.split("\n");
	const changeTypes = new Set();
	const changeCategories = new Set();
	const impactTypes = new Set();
	
	const patterns = CONFIG.releasesInfoPatterns;
	
	for (const line of lines) {
		let match;
		
		match = line.match(patterns.changeType.caption);
		if (match) {
			changeTypes.add(match[1]);
		}
		
		match = line.match(patterns.category.caption);
		if (match) {
			changeCategories.add(match[1]);
		}
		
		match = line.match(patterns.impactType.caption);
		if (match) {
			impactTypes.add(match[1]);
		}
	}
	
	return {
		changeTypes: Array.from(changeTypes),
		changeCategories: Array.from(changeCategories),
		impactTypes: Array.from(impactTypes),
	};
}

function validateChangeNote(fields, fileErrors, releasesInfo) {
	for (const [fieldName, fieldConfig] of Object.entries(CONFIG.changeNoteFields)) {
		validateField(fieldName, fields[fieldName], fieldConfig, fileErrors, releasesInfo);
	}
}

function validateImpactNote(fields, fileErrors, releasesInfo) {
	for (const [fieldName, fieldConfig] of Object.entries(CONFIG.impactNoteFields)) {
		validateField(fieldName, fields[fieldName], fieldConfig, fileErrors, releasesInfo);
	}
}

// Parse and format change notes
export function parseChangeNotes(files, repoPath = '.') {
	const output = [];
	
	for (const file of files) {
		if (!fs.existsSync(path.join(repoPath, file))) {
			continue;
		}
		
		const fields = parseTiddlerFile(file, repoPath);
		if (!fields) {
			continue;
		}
		
		const tags = fields.tags || "";
		
		if (tags.includes("$:/tags/ChangeNote")) {
			output.push(formatChangeNote(fields));
		} else if (tags.includes("$:/tags/ImpactNote")) {
			output.push(formatImpactNote(fields));
		}
	}
	
	return output.join("\n");
}

// Parse and format change notes from content map (for API usage)
export function parseChangeNotesFromContent(fileContents) {
	const output = [];
	
	for (const [file, content] of Object.entries(fileContents)) {
		const fields = parseTiddlerContent(content);
		if (!fields) {
			continue;
		}
		
		const tags = fields.tags || "";
		
		if (tags.includes("$:/tags/ChangeNote")) {
			output.push(formatChangeNote(fields));
		} else if (tags.includes("$:/tags/ImpactNote")) {
			output.push(formatImpactNote(fields));
		}
	}
	
	return output.join("\n");
}

function formatChangeNote(fields) {
	const { title, "change-type": changeType, "change-category": changeCategory,
		description, release, "github-links": githubLinks, "github-contributors": githubContributors } = fields;
	
	let output = `### 📝 ${title || "Untitled"}\n\n`;
	
	output += `Type: **${changeType}** | Category: **${changeCategory}**\n`;
	
	if (release) {
		output += `Release: **${release}**\n`;
	}
	
	output += "\n";
	
	if (description) {
		output += `> ${description}\n\n`;
	}
	
	if (githubLinks) {
		output += `🔗 ${githubLinks}\n\n`;
	}
	
	if (githubContributors) {
		output += `👥 Contributors: **${githubContributors}**\n\n`;
	}
	
	output += "---\n";
	return output;
}

function formatImpactNote(fields) {
	const { title, "impact-type": impactType, changenote, description } = fields;
	
	let output = `### ⚠️ Impact: **${title || "Untitled"}**\n\n`;
	
	output += `Impact Type: **${impactType}**\n`;
	
	if (changenote) {
		output += `Related Change: **${changenote}**\n`;
	}
	
	output += "\n";
	
	if (description) {
		output += `> ${description}\n\n`;
	}
	
	output += "---\n";
	return output;
}
