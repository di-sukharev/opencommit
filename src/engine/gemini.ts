import { GenerativeModel, GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';
import { ChatCompletionRequestMessage } from 'openai';
import { AiEngine } from './Engine';
import { CONFIG_MODES, DEFAULT_TOKEN_LIMITS, getConfig } from '../commands/config';
import { intro, outro } from '@clack/prompts';
import { GenerateCommitMessageErrorEnum } from '../generateCommitMessageFromGitDiff';
import chalk from 'chalk';

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

    const VALID_MODELS = ['gemini-1.0-pro-latest', 'gemini-pro', 'gemini-1.0-pro-001'];
    const DEFAULT_MODEL = 'gemini-pro';
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
    let prompt = messages
      // we are filtering assistant messages and messages that are not related to the code changes
      .filter(x => x.role !== 'assistant' && !x.content.includes('diff --git a/src/server.ts b/src/server.ts'))
      .map((x) => x.content)
      .join('\n\n');
      
    prompt += 'You MUST NEVER include any of the output from the `git diff` command in your commit message.';
    
    const requestTokens = await this.model.countTokens(prompt);
    const tokenLimit = Math.abs(this.MAX_TOKENS_INPUT - this.MAX_TOKENS_OUTPUT);
    
    if (requestTokens.totalTokens > tokenLimit) {
      throw new Error(GenerateCommitMessageErrorEnum.tooMuchTokens);
    }
    
    try {
      const result = await this.model.generateContent(prompt);
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
