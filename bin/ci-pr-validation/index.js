#!/usr/bin/env node

import { Octokit } from '@octokit/rest';
import https from 'https';

function printHelp() {
	console.log(`
Usage:
  node index.js --pr <number> --repo <owner/repo> [--dry-run true] [--mode size:calc]

Options:
  --pr         Pull request number to validate (required)
  --repo       Repository in the format "owner/repo" (required)
  --dry-run    If set to true, validation will be performed without posting comments (default: false)
  --mode       Mode for the action (e.g., size:calc, default) (optional)
  --help, -h   Show this help message

Environment:
  GITHUB_PERSONAL_ACCESS_TOKEN  GitHub token used to authenticate (required)

Example:
  export GITHUB_PERSONAL_ACCESS_TOKEN=ghp_YourTokenHere
  node index.js --pr 42 --repo user/repo --dry-run true
	`);
}

let core,
	token;

function parseArgs() {
	const args = process.argv.slice(2);
	const options = {};

	for (let i = 0; i < args.length; i++) {
		if (args[i].startsWith('--')) {
			const key = args[i].slice(2);
			const value = args[i + 1];
			options[key] = value;
			i++;
		}
	}

	return options;
}

function fetchPRBase(repo, prNumber, token) {
	return new Promise((resolve, reject) => {
		const [owner, repoName] = repo.split('/');
		const options = {
			hostname: 'api.github.com',
			path: `/repos/${owner}/${repoName}/pulls/${prNumber}`,
			method: 'GET',
			headers: {
				'User-Agent': 'validate-pr-cli',
				'Authorization': `token ${token}`,
				'Accept': 'application/vnd.github.v3+json'
			}
		};

		const req = https.request(options, res => {
			let data = '';
			res.on('data', chunk => data += chunk);
			res.on('end', () => {
				if (res.statusCode >= 200 && res.statusCode < 300) {
					const pr = JSON.parse(data);
					resolve(pr.base.ref);
				} else {
					reject(new Error(`GitHub API responded with status ${res.statusCode}: ${data}`));
				}
			});
		});

		req.on('error', reject);
		req.end();
	});
}

async function getCliContext() {
	const options = parseArgs();
	const prNumber = parseInt(options.pr, 10);
	const repo = options.repo;
	token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
	const dryRun = options['dry-run'] === 'true';
	const mode = options.mode || 'rules';

	if (!token || !prNumber || !repo) {
		console.error("❌ Missing required environment variables.");
		printHelp();
		process.exit(1);
	}

	let baseRef;
	try {
		baseRef = await fetchPRBase(repo, prNumber, token);
		console.log(`ℹ️  Using base branch: ${baseRef}`);
	} catch(err) {
		console.error('❌ Failed to fetch base branch:', err.message);
		process.exit(1);
	}

	const [owner, repoName] = repo.split('/');

	return {
		prNumber,
		repo,
		repoUrl: `https://github.com/${repo}`,
		baseRef,
		owner,
		repoName,
		token,
		mode,
		dryRun
	};
}

async function runHandler(key, ...args) {
	const path = `./${key}.js`;

	try {
		const { default: handler } = await import(path);

		if(typeof handler !== 'function') {
			throw new TypeError(`Handler "${key}" is not a function`);
		}

		return await handler(...args);
	} catch(err) {
		console.error(`Error running handler "${key}": ${err.message}`);
		throw err;
	}
}



async function run(context) {
	const octokit = new Octokit({ auth: token });

	console.log(`ℹ️ action mode: ${context.mode}`);

	const handlers = {
		"rules": "validate-rules",
		"size:calc": "build-size-dispatch",
		"size:comment": "build-size-report"
	};

	try {
		const res = await runHandler(handlers[context.mode], context, octokit, context.dryRun);
		if(context.dryRun && context.mode === "size:calc" && res) {
			context.prSize = res.pr_size;
			context.baseSize = res.base_size;
			runHandler(handlers["size:comment"], context, octokit, context.dryRun);
		}
	} catch(err){
		if (!!core) {
			core.setFailed(`Action failed: ${err.message}`);
		} else {
			console.error(`Validation failed: ${err.message}`);
			process.exit(1);
		}
	}
}

(async () => {
	let context;

	if (process.env.GITHUB_ACTIONS === 'true') {
		core = await import('@actions/core');
		const prNumber = parseInt(core.getInput('pr_number'), 10);
		const repo = core.getInput('repo');
		const baseRef = core.getInput('base_ref');
		const mode = core.getInput("mode") || 'rules';
		const dryRun = core.getInput('dry_run') === 'true';
		token = core.getInput('github_token');
		const [owner, repoName] = repo.split('/');

		context = {
			prNumber,
			repo,
			repoUrl: `https://github.com/${repo}`,
			baseRef,
			owner,
			repoName,
			mode,
			dryRun
		};
	} else {
		context = await getCliContext();
	}

	await run(context);
})();
