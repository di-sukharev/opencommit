import { ChatCompletionRequestMessage } from 'openai';
import { AiEngine } from './Engine';
import { Content, GenerativeModel, GoogleGenerativeAI, HarmBlockThreshold, HarmCategory, Part } from '@google/generative-ai';
import { CONFIG_MODES, ConfigType, DEFAULT_TOKEN_LIMITS, getConfig, MODEL_LIST } from '../commands/config';
import { intro, outro } from '@clack/prompts';
import chalk from 'chalk';
import axios from 'axios';


export class Gemini implements AiEngine {

  private readonly config: ConfigType;
  private readonly googleGenerativeAi: GoogleGenerativeAI;
  private ai: GenerativeModel;

  // vars 
  private maxTokens = {
    input: DEFAULT_TOKEN_LIMITS.DEFAULT_MAX_TOKENS_INPUT,
    output: DEFAULT_TOKEN_LIMITS.DEFAULT_MAX_TOKENS_OUTPUT
  };
  private basePath: string;
  private apiKey: string;
  private model: string;

  constructor() {
    this.config = getConfig() as ConfigType;
    this.googleGenerativeAi = new GoogleGenerativeAI(this.config.OCO_GEMINI_API_KEY);
    
    this.warmup();
  }

  async generateCommitMessage(messages: ChatCompletionRequestMessage[]): Promise<string | undefined> {
    const systemInstruction = messages.filter(m => m.role === 'system')
      .map(m => m.content)
      .join('\n');
    
    this.ai = this.googleGenerativeAi.getGenerativeModel({
      model: this.model,
      systemInstruction,
    });
    
    const contents = messages.filter(m => m.role !== 'system')
      .map(m => ({ parts: [{ text: m.content } as Part], role: m.role == 'user' ? m.role : 'model', } as Content));
      
    try {
      const result = await this.ai.generateContent({
        contents, 
        safetySettings: [
          { 
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, 
            threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE, 
          },
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT, 
            threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE
          },
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, 
            threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE
          },
          {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, 
            threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE
          },
        ],
        generationConfig: {
          maxOutputTokens: this.maxTokens.output,
          temperature: 0,
          topP: 0.1,
        },
      });
      
      return result.response.text();
    } catch (error) {
      const err = error as Error;
      outro(`${chalk.red('✖')} ${err?.message || err}`);
      
      if (
        axios.isAxiosError<{ error?: { message: string } }>(error) &&
        error.response?.status === 401
      ) {
        const geminiError = error.response.data.error;

        if (geminiError?.message) outro(geminiError.message);
        outro(
          'For help look into README https://github.com/di-sukharev/opencommit#setup'
        );
      }
      
      throw err;
    }
  }

  private warmup(): void {
    if (this.config.OCO_TOKENS_MAX_INPUT !== undefined) this.maxTokens.input = this.config.OCO_TOKENS_MAX_INPUT;
    if (this.config.OCO_TOKENS_MAX_OUTPUT !== undefined) this.maxTokens.output = this.config.OCO_TOKENS_MAX_OUTPUT;
    this.basePath = this.config.OCO_GEMINI_BASE_PATH;
    this.apiKey = this.config.OCO_GEMINI_API_KEY;

    const [command, mode] = process.argv.slice(2);

    const provider = this.config.OCO_AI_PROVIDER;

    if (provider === 'gemini' && !this.apiKey &&
      command !== 'config' && mode !== 'set') {
      intro('opencommit');

      outro('OCO_GEMINI_API_KEY is not set, please run `oco config set OCO_GEMINI_API_KEY=<your token> . If you are using GPT, make sure you add payment details, so API works.');

      outro(
        'For help look into README https://github.com/di-sukharev/opencommit#setup'
      );

      process.exit(1);
    }
    
    this.model = this.config.OCO_MODEL || MODEL_LIST.gemini[0];
    
    if (provider === 'gemini' &&
      !MODEL_LIST.gemini.includes(this.model) &&
      command !== 'config' &&
      mode !== CONFIG_MODES.set) {
      outro(
        `${chalk.red('✖')} Unsupported model ${this.model} for Gemini. Supported models are: ${MODEL_LIST.gemini.join(
          ', '
        )}`
      );

      process.exit(1);
    }
  }

}