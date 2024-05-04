import { Content, GenerativeModel, GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';
import { ChatCompletionRequestMessage } from 'openai';
import { AiEngine } from './Engine';
import { CONFIG_MODES, DEFAULT_TOKEN_LIMITS, getConfig } from '../commands/config';
import { intro, outro } from '@clack/prompts';
import { GenerateCommitMessageErrorEnum } from '../generateCommitMessageFromGitDiff';
import chalk from 'chalk';

type GeminiMessagePart = {
  text: string;
}

type GeminiChatHistory = {
  role: 'user' | 'model';
  parts: GeminiMessagePart[];
}

export class GeminiAi implements AiEngine {
  private readonly config = getConfig();
  private get MAX_TOKENS_OUTPUT() {
    return this.config?.OCO_TOKENS_MAX_OUTPUT || 30720;
  }
  private get MAX_TOKENS_INPUT() {
    return this.config?.OCO_TOKENS_MAX_INPUT || DEFAULT_TOKEN_LIMITS.DEFAULT_MAX_TOKENS_INPUT;
  }
  private readonly genAi: GoogleGenerativeAI;
  private readonly model: GenerativeModel;

  constructor() {
    const config = getConfig();

    const apiKey = config?.OCO_API_KEY || config?.OCO_OPENAI_API_KEY;
    this.genAi = new GoogleGenerativeAI(apiKey);

    const isGeminiModel = (config?.OCO_AI_PROVIDER as string).trim().toLowerCase() === 'gemini';

    const [command, mode] = process.argv.slice(2);

    if (!apiKey && command !== 'config' && mode !== CONFIG_MODES.set && !isGeminiModel) {
      intro('opencommit');

      outro(
        'OCO_API_KEY is not set, please run `oco config set OCO_API_KEY=<your token> . If you are using GPT, make sure you add payment details, so API works.`'
      );
      outro(
        'For help look into README https://github.com/di-sukharev/opencommit#setup'
      );

      process.exit(1);
    }

    const VALID_MODELS = ['gemini-1.0-pro-latest', 'gemini-pro', 'gemini-1.0-pro-001', 'gemini-1.5-pro-latest'];
    const DEFAULT_MODEL = 'gemini-1.5-pro-latest';
    const MODEL = (config?.OCO_MODEL || DEFAULT_MODEL).trim().toLowerCase();

    if (!VALID_MODELS.includes(MODEL)) {
      intro('opencommit');
      outro(
        `OCO_MODEL is not set to a valid model. Please run 'oco config set OCO_MODEL=${DEFAULT_MODEL}'`
      );
      outro('Valid models are: ' + VALID_MODELS.join(', '));
      process.exit(1);
    }

    this.model = this.genAi.getGenerativeModel({
      model: MODEL,
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
        },
      ]
    });
  }

  async generateCommitMessage(
    messages: Array<ChatCompletionRequestMessage>
  ): Promise<string | undefined> {
    const systemMessages = [] as GeminiMessagePart[];
    const history = {
      user: [] as GeminiMessagePart[],
      model: [] as GeminiMessagePart[],
    };
    
    systemMessages.push(...messages.map(m => {
      if (m.role === 'system') {
        return { text: `${m.content}\n\n
        The commit message should start with a single subject line that is a brief overview description that summarizes all of the changes. It should not 
        exceed 50 characters and should be capitalized and written in the imperative mood. The subject line should be followed by a blank line and then the body of the commit message.\n\n
        The body of the commit should provide more details about the changes made. Each commit message should be a single logical change.\n\n
        Here's an example of a well-formed commit message:\n\n 
        Adds support for the Gemini language model engine, allowing users to utilize Gemini for generating commit messages.\n\n
        ✨ (utils/engine.ts): add support for Gemini engine\n
        ♻️ (openAi.ts & utils/engine.ts): add support for OCO_API_KEY env variable to configure apiKey\n
        ` };
      }
      
      if (m.role === 'user') {
        return { text: `This is an example of a git diff --staged command output, it should not be included in the commit message: \n\n${m.content}`};
      }
      
      return { text: m.content };
    }));

    // for (const message of messages) {
    //   if (message.role === 'system') {
    //     systemMessages.push({ text: message.content });
    //     continue;
    //   }
      
    //   const role = message.role === 'user' ? 'user' : 'model';
    //   const parts = [message.content];

    //   history[role].push(...parts.map(p => ({ text: p })));
    // }

    let prompt: GeminiChatHistory[] = [
      {
        role: 'user',
        parts: [...history.user],
      },
      {
        role: 'model',
        parts: [...history.model],
      }
    ];

    // let prompt = messages.map(m => ({
    //   role: m.role === 'system' ? 'user' : m.role,
    //   parts: [{text: m.content}],
    // }));
    // we are filtering assistant messages and messages that are not related to the code changes
    //   .filter(x => x.role !== 'assistant' && !x.content.includes('diff --git a/src/server.ts b/src/server.ts'))
    //   .map((x) => x.content)
    //   .join('\n\n');

    // prompt += 'You MUST NEVER include any of the output from the `git diff` command in your commit message, and you can ignore changes inside of the `out` directory.\n\n';
    // prompt += `You should include a brief summary of changes to each file in the 'git diff' output as part of the commit message.\n\n`;
    // prompt += 'Lastly, please do not include contextual information explaining new libraries or tools that were added to the project. This information is not necessary for the commit message. The commit message should concisely focus on the changes made to the codebase.';

    const requestTokens = await this.model.countTokens(prompt.map(p => p.parts.join('\n')));
    const tokenLimit = Math.abs(this.MAX_TOKENS_INPUT - this.MAX_TOKENS_OUTPUT);

    if (requestTokens.totalTokens > tokenLimit) {
      throw new Error(GenerateCommitMessageErrorEnum.tooMuchTokens);
    }

    try {
      const chat = await this.model.startChat({
        systemInstruction: { role: 'system', parts: systemMessages } as Content,
        // history: prompt,
      });

      const result = await chat.sendMessage([
        { text: 'You MUST NEVER include any of the output from the `git diff --staged` command in your commit message, and you can ignore changes inside of the `out` directory.' },
        { text: `You should include a brief summary of changes to each file in the 'git diff --staged' output as part of the commit message.` },
        { text: 'Lastly, please do not include contextual information explaining new libraries or tools that were added to the project. This information is not necessary for the commit message. The commit message should concisely focus on the changes made to the codebase.' },
      ]);

      // const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const answer = response.text();

      return answer;
    } catch (err: any) {
      const error = err as Error;

      outro(`${chalk.red('✖')} ${err?.message || err}`);

      throw error;
    }
  }
}
