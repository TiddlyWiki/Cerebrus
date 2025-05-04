import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFileSync } from 'child_process';

const EVENT_TYPE = 'pr_build_size_report';

function runSafe(cmd, args, cwd, options = {}) {
	const command = `${cmd} ${args.join(' ')}`;
	console.log(`> Running: ${command} (cwd: ${cwd})`);

	try {
		const result = execFileSync(cmd, args, {
			cwd,
			stdio: options.captureOutput ? 'pipe' : 'inherit',
			encoding: 'utf8'
		});
		return options.captureOutput ? (options.trim ? result.trim() : result) : undefined;
	} catch(err) {
		throw new Error(`❌ Command failed:\n  ${command}\n  cwd: ${cwd}\n  ${err.message}`);
	}
}


function isSafeGitRef(ref) {
	return /^[a-zA-Z0-9/_\-.]+$/.test(ref);
}

function createTempDirs() {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'compare-size-'));
	const prDir = path.join(root, 'pr');
	const mergeBaseDir = path.join(root, 'merge-base');
	fs.mkdirSync(prDir);
	fs.mkdirSync(mergeBaseDir);
	console.log(`> Created temp root: ${root}`);
	return { root, prDir, mergeBaseDir };
}

function cleanupDir(dirPath) {
	if(fs.existsSync(dirPath)) {
		fs.rmSync(dirPath, { recursive: true, force: true });
		console.log(`> Cleaned up: ${dirPath}`);
	}
}

function getBuildSize(filePath) {
	if(!fs.existsSync(filePath)) {
		throw new Error(`Build output file not found: ${filePath}`);
	}
	const stats = fs.statSync(filePath);
	console.log(`> Measured size of ${filePath}: ${stats.size} bytes`);
	return stats.size;
}

async function checkoutAndBuild(dir, ref) {
	runSafe('git', ['-c','advice.detachedHead=false','checkout', ref], dir);
	runSafe('node', ['tiddlywiki.js', './editions/empty', '--output', 'output', '--build', 'empty'], dir);
	const size = getBuildSize(path.join(dir, 'output/empty.html'));
	return size;
}

async function getMergeBaseCommit(repoUrl, baseRef, workDir, prNumber) {
	const prBranch = `pr-${prNumber}`;
	let mergeBase;
	try {
		runSafe('git', ['clone', '-q', '--no-checkout', repoUrl, workDir]);
		runSafe('git', ['fetch', '-q', 'origin', baseRef], workDir);
		runSafe('git', ['fetch', '-q', 'origin', `pull/${prNumber}/head:${prBranch}`], workDir);

		mergeBase = runSafe('git', ['merge-base', `origin/${baseRef}`, prBranch], workDir, {
			captureOutput: true,
			trim: true
		});

		console.log(`> Merge base between origin/${baseRef} and ${prBranch} is ${mergeBase}`);
	} catch(err) {
		throw err;
	}
	return { mergeBase, prBranch };
}


async function compareSize(context) {
	const { repoUrl, prNumber, baseRef } = context;
	if(!repoUrl || !prNumber) {
		throw new Error('Missing required parameters: repoUrl, prNumber');
	}

	if(!isSafeGitRef(prNumber)) {
		throw new Error(`Unsafe PR ref: ${prNumber}`);
	}

	if(!isSafeGitRef(baseRef)) {
		throw new Error(`Unsafe base ref: ${baseRef}`);
	}

	let root,
		prDir,
		mergeBaseDir;
	try {
		({ root, prDir, mergeBaseDir } = createTempDirs());

		const { mergeBase, prBranch } = await getMergeBaseCommit(repoUrl, baseRef, mergeBaseDir, prNumber);

		fs.cpSync(mergeBaseDir, prDir, { recursive: true });

		const [prSize, baseSize] = await Promise.all([
			checkoutAndBuild(prDir, prBranch),
			checkoutAndBuild(mergeBaseDir, mergeBase)
		]);

		return {
			pr_size: prSize,
			base_size: baseSize,
			merge_base: mergeBase
		};
	} finally {
		if(root) {
			cleanupDir(root);
		}
	}
}

async function dispatchEvent(octokit, owner, repo, payload) {
	await octokit.rest.repos.createDispatchEvent({
		owner,
		repo,
		event_type: EVENT_TYPE,
		client_payload: payload
	});
}

async function calculateAndDispatch(context, octokit, dryRun) {
	try {
		const sizes = await compareSize(context);

		console.log(`ℹ️  Calculated sizes of PR build and base (merge-base) build`);

		const eventPayload = {
			pr_number: context.prNumber,
			pr_size: sizes.pr_size,
			base_size: sizes.base_size,
			base_branch: context.baseRef,
			merge_base: sizes.merge_base
		};

		if(dryRun) {
			console.log(`ℹ️  [dry-run] Would dispatch GitHub event to ${context.repo}`);
			console.log(`🔸 Event type: ${EVENT_TYPE}`);
			console.log(`🔸 Payload:\n${JSON.stringify(eventPayload, null, 2)}`);
		} else {
			console.log(`ℹ️  Dispatching ${EVENT_TYPE} event to ${context.repo}`);
			console.log(`🔸 Payload:\n${JSON.stringify(eventPayload, null, 2)}`);
			await dispatchEvent(octokit, context.owner, context.repoName, eventPayload);
		}
		return sizes;
	} catch(err) {
		console.error(`❌ Error in calculateAndDispatch: ${err.message}`);
		throw err;
	}
}

export default calculateAndDispatch;
