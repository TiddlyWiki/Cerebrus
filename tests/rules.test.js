const rules = require('../bin/ci-pr-validation/rules');

describe('Validation Rules', () => {
	
	describe('tiddlywiki-com: enforce editions only', () => {
		const rule = rules.find(r => r.id === 1);

		it('should trigger error if file is outside /editions folder', () => {
			const baseRef = 'tiddlywiki-com';
			const changedFiles = ['editions/file1.txt', 'other-folder/file2.txt'];
			expect(rule.condition(baseRef, changedFiles)).toBe(true);
		});

		it('should not trigger error if file is CLA file only', () => {
			const baseRef = 'tiddlywiki-com';
			const changedFiles = ['licenses/cla-individual.md'];
			expect(rule.condition(baseRef, changedFiles)).toBe(false);
		});

		it('should not trigger error if all files are in /editions folder', () => {
			const baseRef = 'tiddlywiki-com';
			const changedFiles = ['editions/file1.txt', 'editions/file2.txt'];
			expect(rule.condition(baseRef, changedFiles)).toBe(false);
		});

		it('should not trigger error for other baseRef branches', () => {
			const baseRef = 'master';
			const changedFiles = ['editions/file1.txt', 'other-folder/file2.txt'];
			expect(rule.condition(baseRef, changedFiles)).toBe(false);
		});
		it('should generate correct error message for tiddlywiki-com', () => {
				const baseRef = 'tiddlywiki-com';
				const changedFiles = ['editions/file1.txt', 'other-folder/file2.txt'];
				if (rule.condition(baseRef, changedFiles)) {
					expect(rule.message).toMatch(/PRs targeting the `tiddlywiki-com` branch/);
				}
			});
	});

	describe('master: check docs only', () => {
		const rule = rules.find(r => r.id === 2);

		it('should trigger warning if all files are in /editions folder', () => {
			const baseRef = 'master';
			const changedFiles = ['editions/file1.txt', 'editions/file2.txt'];
			expect(rule.condition(baseRef, changedFiles)).toBe(true);
		});

		it('should not trigger warning if there are files outside /editions folder', () => {
			const baseRef = 'master';
			const changedFiles = ['editions/file1.txt', 'other-folder/file2.txt'];
			expect(rule.condition(baseRef, changedFiles)).toBe(false);
		});

		it('should not trigger warning for other baseRef branches', () => {
			const baseRef = 'tiddlywiki-com';
			const changedFiles = ['editions/file1.txt', 'other-folder/file2.txt'];
			expect(rule.condition(baseRef, changedFiles)).toBe(false);
		});
	});

	describe('cla: ensure only license files and branch is tiddlywiki-com', () => {
		const rule = rules.find(r => r.id === 3);
	
		it('should trigger error if files in licenses/ folder and more than one file in PR', () => {
			const baseRef = 'tiddlywiki-com';
			const changedFiles = ['licenses/license.txt', 'editions/file1.txt'];
			expect(rule.condition(baseRef, changedFiles)).toBe(true);
		});
	
		it('should not trigger error if no files in licenses/ folder', () => {
			const baseRef = 'tiddlywiki-com';
			const changedFiles = ['editions/file1.txt'];
			expect(rule.condition(baseRef, changedFiles)).toBe(false);
		});
	
		it('should not trigger error if only one file in PR and it is in licenses/ folder', () => {
			const baseRef = 'tiddlywiki-com';
			const changedFiles = ['licenses/license.txt'];
			expect(rule.condition(baseRef, changedFiles)).toBe(false);
		});
	
		it('should trigger error for non-tiddlywiki-com baseRef', () => {
			const baseRef = 'master';
			const changedFiles = ['licenses/license.txt'];
			expect(rule.condition(baseRef, changedFiles)).toBe(true);
		});
	});

	describe('auto-generated files check', () => {
		const rule = rules.find(r => r.id === 4);
	
		it('should trigger error if /readme.md is present', () => {
			const baseRef = 'tiddlywiki-com';
			const changedFiles = ['/readme.md', 'editions/file1.txt'];
			expect(rule.condition(baseRef, changedFiles)).toBe(true);
		});
	
		it('should trigger error if /bin/readme.md is present', () => {
			const baseRef = 'tiddlywiki-com';
			const changedFiles = ['/bin/readme.md', 'editions/file2.txt'];
			expect(rule.condition(baseRef, changedFiles)).toBe(true);
		});
	
		it('should trigger error if contributing.md is present', () => {
			const baseRef = 'tiddlywiki-com';
			const changedFiles = ['contributing.md', 'editions/file3.txt'];
			expect(rule.condition(baseRef, changedFiles)).toBe(true);
		});
	
		it('should trigger error if license is present', () => {
			const baseRef = 'tiddlywiki-com';
			const changedFiles = ['license', 'editions/file4.txt'];
			expect(rule.condition(baseRef, changedFiles)).toBe(true);
		});
	
		it('should not trigger error if none of the trigger files are present', () => {
			const baseRef = 'tiddlywiki-com';
			const changedFiles = ['editions/file1.txt', 'editions/file2.txt'];
			expect(rule.condition(baseRef, changedFiles)).toBe(false);
		});
	});

});
