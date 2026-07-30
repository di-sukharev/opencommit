import { buildGitPushArgs, GitPushOptions } from 'utils/gitPush';

describe('buildGitPushArgs', () => {
  it.each<{
    name: string;
    options: GitPushOptions;
    upstreamBranch: string | null;
    expected: string[];
  }>([
    {
      name: 'uses the implicit upstream when one exists',
      options: { mode: 'default', fallbackRemote: 'origin' },
      upstreamBranch: null,
      expected: ['push']
    },
    {
      name: 'sets the fallback remote and branch without an upstream',
      options: { mode: 'default', fallbackRemote: 'origin' },
      upstreamBranch: 'feature/refactor',
      expected: ['push', '--set-upstream', 'origin', 'feature/refactor']
    },
    {
      name: 'preserves an empty current branch argument',
      options: { mode: 'default', fallbackRemote: 'origin' },
      upstreamBranch: '',
      expected: ['push', '--set-upstream', 'origin', '']
    },
    {
      name: 'uses verbose remote push with an existing upstream',
      options: { mode: 'remote', remote: 'origin', verbose: true },
      upstreamBranch: null,
      expected: ['push', '--verbose', 'origin']
    },
    {
      name: 'appends the branch to a verbose remote push',
      options: { mode: 'remote', remote: 'origin', verbose: true },
      upstreamBranch: 'feature/refactor',
      expected: [
        'push',
        '--verbose',
        'origin',
        '--set-upstream',
        'feature/refactor'
      ]
    },
    {
      name: 'appends the branch to a selected remote push',
      options: { mode: 'remote', remote: 'upstream', verbose: false },
      upstreamBranch: 'feature/refactor',
      expected: ['push', 'upstream', '--set-upstream', 'feature/refactor']
    }
  ])('$name', ({ options, upstreamBranch, expected }) => {
    expect(buildGitPushArgs(options, upstreamBranch)).toEqual(expected);
  });
});
