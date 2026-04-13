import {
  Content,
  FinishReason,
  GenerateContentResponse,
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
  Part
} from '@google/generative-ai';
import { OpenAI } from 'openai';
import { normalizeEngineError } from '../utils/engineErrorHandler';
import { removeContentTags } from '../utils/removeContentTags';
import { AiEngine, AiEngineConfig } from './Engine';

interface GeminiConfig extends AiEngineConfig {}

const GEMINI_BLOCKING_FINISH_REASONS = new Set<FinishReason>([
  FinishReason.RECITATION,
  FinishReason.SAFETY,
  FinishReason.LANGUAGE
]);

const formatGeminiBlockMessage = (
  response: GenerateContentResponse
): string => {
  const promptFeedback = response.promptFeedback;
  if (promptFeedback?.blockReason) {
    return promptFeedback.blockReasonMessage
      ? `Gemini response was blocked due to ${promptFeedback.blockReason}: ${promptFeedback.blockReasonMessage}`
      : `Gemini response was blocked due to ${promptFeedback.blockReason}`;
  }

  const firstCandidate = response.candidates?.[0];
  if (firstCandidate?.finishReason) {
    return firstCandidate.finishMessage
      ? `Gemini response was blocked due to ${firstCandidate.finishReason}: ${firstCandidate.finishMessage}`
      : `Gemini response was blocked due to ${firstCandidate.finishReason}`;
  }

  return 'Gemini response did not contain usable text';
};

const extractGeminiText = (response: GenerateContentResponse): string => {
  const firstCandidate = response.candidates?.[0];

  if (
    firstCandidate?.finishReason &&
    GEMINI_BLOCKING_FINISH_REASONS.has(firstCandidate.finishReason)
  ) {
    throw new Error(formatGeminiBlockMessage(response));
  }

  const text = firstCandidate?.content?.parts
    ?.flatMap((part) =>
      'text' in part && typeof part.text === 'string' ? [part.text] : []
    )
    .join('');

  if (typeof text === 'string' && text.length > 0) {
    return text;
  }

  if (response.promptFeedback?.blockReason) {
    throw new Error(formatGeminiBlockMessage(response));
  }

  return '';
};

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

    const gemini = this.client.getGenerativeModel(
      {
        model: this.config.model,
        systemInstruction
      },
      {
        baseUrl: this.config.baseURL
      }
    );

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

      const content = extractGeminiText(result.response);
      return removeContentTags(content, 'think');
    } catch (error) {
      throw normalizeEngineError(error, 'gemini', this.config.model);
    }
  }
}
