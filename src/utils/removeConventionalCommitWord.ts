export function removeConventionalCommitWord(message: string): string {
  return message.replace(/^(fix|feat)\((.+?)\):/, '($2):');
}
