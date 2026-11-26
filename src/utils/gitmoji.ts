import { removeConventionalCommitWord } from './removeConventionalCommitWord';

type GitMojiOptions = {
  beforeDescription: boolean;
  emoji: string;
  message: string;
};

export const getGitMojiPositionInstruction = (
  beforeDescription: boolean
): string =>
  beforeDescription
    ? 'Place the GitMoji immediately before the commit subject, after the Conventional Commit type and optional scope. Example: "chore(config): 🔧 update lint rules".'
    : 'Place the GitMoji at the start of the commit header. Example: "🔧 (config): update lint rules".';

export const formatGitMojiCommit = ({
  beforeDescription,
  emoji,
  message
}: GitMojiOptions): string => {
  if (!beforeDescription) {
    return `${emoji} ${removeConventionalCommitWord(message)}`;
  }

  const separatorIndex = message.search(/[:：]/);
  if (separatorIndex === -1) return `${emoji} ${message}`;

  const header = message.slice(0, separatorIndex + 1);
  const description = message.slice(separatorIndex + 1).trimStart();

  return `${header} ${emoji}${description ? ` ${description}` : ''}`;
};
