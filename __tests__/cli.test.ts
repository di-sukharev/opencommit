// @ts-ignore
// import { jest } from '@jest/globals';

import { generateCommitMessageByDiff } from '../src/generateCommitMessageFromGitDiff';

test.skip('generateCommitMessageFromGitDiff', async () => {
  const GIT_DIFF = ``;

  const res = await generateCommitMessageByDiff(GIT_DIFF);

  expect(res).toBe('lol');
});
