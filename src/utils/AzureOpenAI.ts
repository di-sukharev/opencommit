/** Azure OpenAI Service API
 * https://learn.microsoft.com/azure/cognitive-services/openai/
 * The API version of the Azure OpenAI Service 2023-03-15-preview
 *
 * Note: Only make what is necessary for opencommit
 */

import {
  CreateChatCompletionRequest,
  Configuration,
} from "openai";
import { BaseAPI, RequiredError } from 'openai/dist/base';
import { AxiosRequestConfig} from 'openai/node_modules/axios';

export class AzureOpenAIApi extends BaseAPI {
  constructor(configuration: Configuration) {
    super(configuration);
  }

  /**
   *
   * @summary Creates a completion for the chat message
   * @param {CreateChatCompletionRequest} createChatCompletionRequest
   * @param {*} [options] Override http request option.
   * @throws {RequiredError}
   * @memberof AzureOpenAIApi
   */
  public async createChatCompletion(createChatCompletionRequest: CreateChatCompletionRequest, options?: AxiosRequestConfig) {
    if (!this.configuration) {
      throw new RequiredError('configuration', 'Required configuration was null or undefined when calling createChatCompletion.');
    }
    if (!this.configuration.basePath) {
      throw new RequiredError('basePath', 'Required configuration basePath was null or undefined when calling createChatCompletion.');
    }
    if (!this.configuration.apiKey) {
      throw new RequiredError('apiKey', 'Required configuration apiKey was null or undefined when calling createChatCompletion.');
    }
    if (typeof this.configuration.apiKey !== 'string') {
        throw new RequiredError('apiKey', 'Required configuration apiKey was not string when calling createChatCompletion');
    }

    const url = this.configuration.basePath + 'openai/deployments/' + createChatCompletionRequest.model + '/chat/completions';
    if (!options) options = {};
    if (!options.headers) options.headers = {};
    if (!options.params) options.params = {};
    options.headers = {
      'Content-Type': 'application/json',
      "api-key": this.configuration.apiKey,
      ...options.headers,
    }
    options.params = {
      'api-version': '2023-03-15-preview',
      ...options.params,
    }

    // Azure OpenAI API REST call
    const response = await this.axios.post(url, createChatCompletionRequest, options);

    return response;
  }

}


