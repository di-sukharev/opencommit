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
import { BaseAPI } from 'openai/dist/base';
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
      throw new Error('Required parameter configuration was null or undefined when calling createChatCompletion.');
    }
    if (!this.configuration.basePath) {
      throw new Error('Required parameter basePath was null or undefined when calling createChatCompletion.');
    }
    if (!this.configuration.apiKey) {
      throw new Error('Required parameter apiKey was null or undefined when calling createChatCompletion.');
    }
    if (typeof this.configuration.apiKey !== 'string') {
      throw new Error('Required parameter apiKey was of type string when calling createChatCompletion.');
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

    // axios DEBUG
    // this.axios.interceptors.request.use(request => {
    //   console.log('Starting Request: ', request)
    //   return request
    // })
    // this.axios.interceptors.response.use(response => {
    //   console.log('Response: ', response)
    //   return response
    // })

    // Azure OpenAI APIのREST呼び出し
    const response = await this.axios.post(url, createChatCompletionRequest, options);

    // console.log(response.data.usage);
    return response;
  }

}


