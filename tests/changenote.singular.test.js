import { validateChangeNotesFromContent } from '../bin/ci-pr-validation/changenote.js';

describe('ReleasesInfo.multids singular parsing', () => {
  it('should parse singular fields for changeTypes, changeCategories, impactTypes', () => {
    const releasesInfoContent = [
      'change-types/bugfix/singular: Bugfix',
      'categories/plugin/singular: Plugin',
      'impact-types/breaking/singular: Breaking',
    ].join('\n');
    const fileContents = {
      'editions/tw5.com/tiddlers/releasenotes/test.tid': `title: $:/changenotes/5.4.0/#123\ntags: $:/tags/ChangeNote\nchange-type: bugfix\nchange-category: plugin\ndescription: Fixes an issue\nrelease: 5.4.0\ngithub-links: https://github.com/TiddlyWiki/TiddlyWiki5/pull/123\ngithub-contributors: @contributor\n`,
    };
    const result = validateChangeNotesFromContent(fileContents, releasesInfoContent);
    expect(result.success).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('should keep supporting legacy caption fields', () => {
    const releasesInfoContent = [
      'change-types/bugfix/caption: Bugfix',
      'categories/plugin/caption: Plugin',
      'impact-types/breaking/caption: Breaking',
    ].join('\n');
    const fileContents = {
      'editions/tw5.com/tiddlers/releasenotes/test.tid': `title: $:/changenotes/5.4.0/#124\ntags: $:/tags/ChangeNote\nchange-type: bugfix\nchange-category: plugin\ndescription: Keeps backward compatibility\nrelease: 5.4.0\ngithub-links: https://github.com/TiddlyWiki/TiddlyWiki5/pull/124\ngithub-contributors: @contributor\n`,
    };
    const result = validateChangeNotesFromContent(fileContents, releasesInfoContent);
    expect(result.success).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('should fail if change-type is not in singular list', () => {
    const releasesInfoContent = [
      'change-types/bugfix/singular: Bugfix',
      'categories/plugin/singular: Plugin',
    ].join('\n');
    const fileContents = {
      'editions/tw5.com/tiddlers/releasenotes/test.tid': `title: $:/changenotes/5.4.0/#125\ntags: $:/tags/ChangeNote\nchange-type: notvalid\nchange-category: plugin\ndescription: Invalid type\nrelease: 5.4.0\ngithub-links: https://github.com/TiddlyWiki/TiddlyWiki5/pull/125\ngithub-contributors: @contributor\n`,
    };
    const result = validateChangeNotesFromContent(fileContents, releasesInfoContent);
    expect(result.success).toBe(false);
    expect(result.errors[0].issues.join('\n')).toMatch(/not valid/);
  });
});
