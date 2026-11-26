import { formatGitMojiCommit } from '../../src/utils/gitmoji';

describe('formatGitMojiCommit', () => {
  it.each([
    {
      expected: '修正(server.ts)： 🐛 將端口變數改為大寫',
      message: '修正(server.ts)：將端口變數改為大寫'
    },
    {
      expected: 'fix: 🐛 handle an unavailable port',
      message: 'fix: handle an unavailable port'
    }
  ])(
    'places GitMoji before the description in "$message"',
    ({ expected, message }) => {
      expect(
        formatGitMojiCommit({
          beforeDescription: true,
          emoji: '🐛',
          message
        })
      ).toBe(expected);
    }
  );

  it('falls back to prefixing messages without a header separator', () => {
    expect(
      formatGitMojiCommit({
        beforeDescription: true,
        emoji: '🐛',
        message: 'handle an unavailable port'
      })
    ).toBe('🐛 handle an unavailable port');
  });
});
