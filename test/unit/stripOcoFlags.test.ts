import { stripOcoFlags } from 'utils/stripOcoFlags';

describe('stripOcoFlags', () => {
  it.each([
    {
      argv: ['commit', '-c', 'incident', '--amend'],
      expected: ['commit', '--amend']
    },
    {
      argv: ['--context', '--yes', '--amend'],
      expected: ['--amend']
    },
    {
      argv: ['--amend', '-c'],
      expected: ['--amend']
    },
    {
      argv: ['-c', '--context', 'incident', '--amend'],
      expected: ['incident', '--amend']
    }
  ])(
    'consumes one token after a separate context flag',
    ({ argv, expected }) => {
      expect(stripOcoFlags(argv)).toEqual(expected);
    }
  );

  it.each([
    {
      argv: ['-c=', 'next'],
      expected: ['next']
    },
    {
      argv: ['--context=incident', '--amend'],
      expected: ['--amend']
    }
  ])(
    'does not consume a token after an equals context form',
    ({ argv, expected }) => {
      expect(stripOcoFlags(argv)).toEqual(expected);
    }
  );

  it('removes exact and equals boolean flags without consuming other args', () => {
    expect(
      stripOcoFlags(['--yes', '--amend', '-y=false', 'keep', '--fgm=1', 'tail'])
    ).toEqual(['--amend', 'keep', 'tail']);
  });

  it('preserves similarly named unknown flags', () => {
    const argv = [
      '-context',
      '--contextual=value',
      '--yes-please',
      '--fgm-extra',
      '-cx'
    ];

    expect(stripOcoFlags(argv)).toEqual(argv);
  });

  it('preserves the order of all forwarded arguments', () => {
    expect(
      stripOcoFlags([
        '--author=Example',
        '--yes',
        '--no-verify',
        '--context=incident',
        '--signoff'
      ])
    ).toEqual(['--author=Example', '--no-verify', '--signoff']);
  });

  it('continues filtering OpenCommit flags after the argument separator', () => {
    expect(
      stripOcoFlags(['--', '--yes', 'keep', '--context=incident', 'tail'])
    ).toEqual(['--', 'keep', 'tail']);
  });

  it('does not mutate the input argv', () => {
    const argv = ['--yes', '--context', 'incident', '--amend'];

    stripOcoFlags(argv);

    expect(argv).toEqual(['--yes', '--context', 'incident', '--amend']);
  });
});
