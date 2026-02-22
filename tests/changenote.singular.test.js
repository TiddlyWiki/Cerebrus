import { validateChangeNotesFromContent } from '../bin/ci-pr-validation/changenote.js';

describe('ReleasesInfo.multids singular parsing', () => {
  it('should parse singular fields for changeTypes, changeCategories, impactTypes', () => {
    const releasesInfoContent = [
      'change-types/bugfix/singular: Bugfix',
      'categories/plugin/singular: Plugin',
      'impact-types/breaking/singular: Breaking',
    ].join('\n');
    const fileContents = {
      'editions/tw5.com/tiddlers/releasenotes/test.tid': `tags: $:/tags/ChangeNote\nchange-type: bugfix\nchange-category: plugin\nimpact-type: breaking\n`,
    };
    const result = validateChangeNotesFromContent(fileContents, releasesInfoContent);
    expect(result.success).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('should fail if change-type is not in singular list', () => {
    const releasesInfoContent = [
      'change-types/bugfix/singular: Bugfix',
    ].join('\n');
    const fileContents = {
      'editions/tw5.com/tiddlers/releasenotes/test.tid': `tags: $:/tags/ChangeNote\nchange-type: notvalid\nchange-category: plugin\nimpact-type: breaking\n`,
    };
    const result = validateChangeNotesFromContent(fileContents, releasesInfoContent);
    expect(result.success).toBe(false);
    expect(result.errors[0].issues[0]).toMatch(/not valid/);
  });
});
