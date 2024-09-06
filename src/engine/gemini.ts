import {
  Content,
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
  Part
} from '@google/generative-ai';
import axios from 'axios';
import { OpenAI } from 'openai';
import { AiEngine, AiEngineConfig } from './Engine';

interface GeminiConfig extends AiEngineConfig {}

export class GeminiEngine implements AiEngine {
  config: GeminiConfig;
  client: GoogleGenerativeAI;

  constructor(config) {
    this.client = new GoogleGenerativeAI(config.apiKey);
    this.config = config;
  }

  async generateCommitMessage(
    messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>
  ): Promise<string | undefined> {
    const systemInstruction = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n');

    const gemini = this.client.getGenerativeModel({
      model: this.config.model,
      systemInstruction
    });

    const contents = messages
      .filter((m) => m.role !== 'system')
      .map(
        (m) =>
          ({
            parts: [{ text: m.content } as Part],
            role: m.role === 'user' ? m.role : 'model'
          } as Content)
      );

    try {
      const result = await gemini.generateContent({
        contents,
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE
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
          }
        ],
        generationConfig: {
          maxOutputTokens: this.config.maxTokensOutput,
          temperature: 0,
          topP: 0.1
        }
      });

      return result.response.text();
    } catch (error) {
      const err = error as Error;
      if (
        axios.isAxiosError<{ error?: { message: string } }>(error) &&
        error.response?.status === 401
      ) {
        const geminiError = error.response.data.error;
        if (geminiError) throw new Error(geminiError?.message);
      }

      throw err;
    }
  }
}
