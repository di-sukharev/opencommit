export type GitPushOptions =
  | {
      mode: 'default';
      fallbackRemote: string;
    }
  | {
      mode: 'remote';
      remote: string;
      verbose: boolean;
    };

export function buildGitPushArgs(
  options: GitPushOptions,
  upstreamBranch: string | null
): string[] {
  const args = ['push'];

  if (options.mode === 'remote') {
    if (options.verbose) args.push('--verbose');
    args.push(options.remote);
  }

  if (upstreamBranch !== null) {
    args.push('--set-upstream');
    if (options.mode === 'default') args.push(options.fallbackRemote);
    args.push(upstreamBranch);
  }

  return args;
}
