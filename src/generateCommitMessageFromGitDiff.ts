import {
  ChatCompletionRequestMessage,
  ChatCompletionRequestMessageRoleEnum
} from 'openai';
import { api } from './api';
import { getConfig } from './commands/config';
import { mergeStrings } from './utils/mergeStrings';

const config = getConfig();

const INIT_MESSAGES_PROMPT: Array<ChatCompletionRequestMessage> = [
  {
    role: ChatCompletionRequestMessageRoleEnum.System,
    content: `You are to act as the author of a commit message in git. Your mission is to create clean and comprehensive commit messages in the conventional commit convention. I'll send you an output of 'git diff --staged' command, and you convert it into a commit message. ${
      config?.emoji
        ? 'Use Gitmoji convention to preface the commit'
        : 'Do not preface the commit with anything'
    }, use the present tense. ${
      config?.description
        ? 'Add a short description of what commit is about after the commit message. Don\'t start it with "This commit", just describe the changes.'
        : "Don't add any descriptions to the commit, only commit message."
    }`
  },
  {
    role: ChatCompletionRequestMessageRoleEnum.User,
    content: `diff --git a/src/server.ts b/src/server.ts
  index ad4db42..f3b18a9 100644
  --- a/src/server.ts
  +++ b/src/server.ts
  @@ -10,7 +10,7 @@ import {
    initWinstonLogger();
    
    const app = express();
  -const port = 7799;
  +const PORT = 7799;
    
    app.use(express.json());
    
  @@ -34,6 +34,6 @@ app.use((_, res, next) => {
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
    // prettier-ignore
    content: `* ${config?.emoji ? '🐛 ' : ''}fix(server.ts): change port variable case from lowercase port to uppercase PORT
* ${config?.emoji ? '✨ ' : ''}feat(server.ts): add support for process.env.PORT environment variable
${config?.description ? 'The port variable is now named PORT, which improves consistency with the naming conventions as PORT is a constant. Support for an environment variable allows the application to be more flexible as it can now run on any available port specified via the process.env.PORT environment variable.' : ''}`
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
  (msg) => msg.content
).join('').length;

const MAX_REQ_TOKENS = 3900 - INIT_MESSAGES_PROMPT_LENGTH;

export const generateCommitMessageWithChatCompletion = async (
  diff: string
): Promise<string | GenerateCommitMessageError> => {
  try {
    if (diff.length >= MAX_REQ_TOKENS) {
      const commitMessagePromises = getCommitMsgsPromisesFromFileDiffs(diff);

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

function getMessagesPromisesByLines(fileDiff: string, separator: string) {
  const [fileHeader, ...fileDiffByLines] = fileDiff.split('\n@@');
  const lineDiffsWithHeader = fileDiffByLines.map(
    (d) => fileHeader + '\n@@' + d
  );

  const mergedLines = mergeStrings(lineDiffsWithHeader, MAX_REQ_TOKENS);

  const commitMsgsFromFileLineDiffs = mergedLines.map((d) => {
    const messages = generateCommitMessageChatCompletionPrompt(separator + d);

    return api.generateCommitMessage(messages);
  });

  return commitMsgsFromFileLineDiffs;
}

function getCommitMsgsPromisesFromFileDiffs(diff: string) {
  const separator = 'diff --git ';

  const diffByFiles = diff.split(separator).slice(1);

  const mergedDiffs = mergeStrings(diffByFiles, MAX_REQ_TOKENS);

  const commitMessagePromises = [];

  for (const fileDiff of mergedDiffs) {
    if (fileDiff.length >= MAX_REQ_TOKENS) {
      // split fileDiff into lineDiff
      const messagesPromises = getMessagesPromisesByLines(fileDiff, separator);

      commitMessagePromises.push(...messagesPromises);
    } else {
      // generate commits for files
      const messages = generateCommitMessageChatCompletionPrompt(
        separator + fileDiff
      );

      commitMessagePromises.push(api.generateCommitMessage(messages));
    }
  }
  return commitMessagePromises;
}
