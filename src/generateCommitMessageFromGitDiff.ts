import {
  ChatCompletionRequestMessage,
  ChatCompletionRequestMessageRoleEnum
} from 'openai';
import { api } from './api';
import { getConfig } from './commands/config';
import { mergeDiffs } from './utils/mergeDiffs';
import { i18n, I18nLocals } from './i18n';
import { tokenCount } from './utils/tokenCount';

const config = getConfig();
const translation = i18n[(config?.language as I18nLocals) || 'en'];

const INIT_MESSAGES_PROMPT: Array<ChatCompletionRequestMessage> = [
  {
    role: ChatCompletionRequestMessageRoleEnum.System,
    // prettier-ignore
    content: `You are to act as the author of a commit message in git. Your mission is to create clean and comprehensive commit messages in the conventional commit convention and explain why a change was done. I'll send you an output of 'git diff --staged' command, and you convert it into a commit message.
${config?.emoji? 'Use GitMoji convention to preface the commit.': 'Do not preface the commit with anything.'}
${config?.description  ? 'Add a short description of WHY the changes are done after the commit message. Don\'t start it with "This commit", just describe the changes.': "Don't add any descriptions to the commit, only commit message."}
Use the present tense. Lines must not be longer than 74 characters. Use ${translation.localLanguage} to answer.`
  },
  {
    role: ChatCompletionRequestMessageRoleEnum.User,
    content: `diff --git a/src/server.ts b/src/server.ts
index ad4db42..f3b18a9 100644
--- a/src/server.ts
+++ b/src/server.ts
@@ -10,7 +10,7 @@
import {
  initWinstonLogger();
  
  const app = express();
 -const port = 7799;
 +const PORT = 7799;
  
  app.use(express.json());
  
@@ -34,6 +34,6 @@
app.use((_, res, next) => {
  // ROUTES
  app.use(PROTECTED_ROUTER_URL, protectedRouter);
  
 -app.listen(port, () => {
 -  console.log(\`Server listening on port \${port}\`);
 +app.listen(process.env.PORT || PORT, () => {
 +  console.log(\`Server listening on port \${PORT}\`);
  });`
  },
  {
    role: ChatCompletionRequestMessageRoleEnum.Assistant,
    content: `${config?.emoji ? '🐛 ' : ''}${translation.commitFix}
${config?.emoji ? '✨ ' : ''}${translation.commitFeat}
${config?.description ? translation.commitDescription : ''}`
  }
];

const generateCommitMessageChatCompletionPrompt = (
  diff: string
): Array<ChatCompletionRequestMessage> => {
  const chatContextAsCompletionRequest = [...INIT_MESSAGES_PROMPT];

  chatContextAsCompletionRequest.push({
    role: ChatCompletionRequestMessageRoleEnum.User,
    content: diff
  });

  return chatContextAsCompletionRequest;
};

export enum GenerateCommitMessageErrorEnum {
  tooMuchTokens = 'TOO_MUCH_TOKENS',
  internalError = 'INTERNAL_ERROR',
  emptyMessage = 'EMPTY_MESSAGE'
}

interface GenerateCommitMessageError {
  error: GenerateCommitMessageErrorEnum;
}

const INIT_MESSAGES_PROMPT_LENGTH = INIT_MESSAGES_PROMPT.map(
  (msg) => tokenCount(msg.content) + 4
).reduce((a, b) => a + b, 0);

const MAX_REQ_TOKENS = 3900 - INIT_MESSAGES_PROMPT_LENGTH;

export const generateCommitMessageWithChatCompletion = async (
  diff: string
): Promise<string | GenerateCommitMessageError> => {
  try {
    if (tokenCount(diff) >= MAX_REQ_TOKENS) {
      const commitMessagePromises = getCommitMsgsPromisesFromFileDiffs(
        diff,
        MAX_REQ_TOKENS
      );

      const commitMessages = await Promise.all(commitMessagePromises);

      return commitMessages.join('\n\n');
    } else {
      const messages = generateCommitMessageChatCompletionPrompt(diff);

      const commitMessage = await api.generateCommitMessage(messages);

      if (!commitMessage)
        return { error: GenerateCommitMessageErrorEnum.emptyMessage };

      return commitMessage;
    }
  } catch (error) {
    return { error: GenerateCommitMessageErrorEnum.internalError };
  }
};

function getMessagesPromisesByChangesInFile(
  fileDiff: string,
  separator: string,
  maxChangeLength: number
) {
  const hunkHeaderSeparator = '@@ ';
  const [fileHeader, ...fileDiffByLines] = fileDiff.split(hunkHeaderSeparator);

  // merge multiple line-diffs into 1 to save tokens
  const mergedChanges = mergeDiffs(
    fileDiffByLines.map((line) => hunkHeaderSeparator + line),
    maxChangeLength
  );

  const lineDiffsWithHeader = mergedChanges.map(
    (change) => fileHeader + change
  );

  const commitMsgsFromFileLineDiffs = lineDiffsWithHeader.map((lineDiff) => {
    const messages = generateCommitMessageChatCompletionPrompt(
      separator + lineDiff
    );

    return api.generateCommitMessage(messages);
  });

  return commitMsgsFromFileLineDiffs;
}

export function getCommitMsgsPromisesFromFileDiffs(
  diff: string,
  maxDiffLength: number
) {
  const separator = 'diff --git ';

  const diffByFiles = diff.split(separator).slice(1);

  // merge multiple files-diffs into 1 prompt to save tokens
  const mergedFilesDiffs = mergeDiffs(diffByFiles, maxDiffLength);

  const commitMessagePromises = [];

  for (const fileDiff of mergedFilesDiffs) {
    if (tokenCount(fileDiff) >= maxDiffLength) {
      // if file-diff is bigger than gpt context — split fileDiff into lineDiff
      const messagesPromises = getMessagesPromisesByChangesInFile(
        fileDiff,
        separator,
        maxDiffLength
      );

      commitMessagePromises.push(...messagesPromises);
    } else {
      const messages = generateCommitMessageChatCompletionPrompt(
        separator + fileDiff
      );

      commitMessagePromises.push(api.generateCommitMessage(messages));
    }
  }
  return commitMessagePromises;
}
