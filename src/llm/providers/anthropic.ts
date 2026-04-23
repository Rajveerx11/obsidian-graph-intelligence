/**
 * Anthropic Provider — Cloud LLM via Anthropic Messages API
 *
 * Uses the Anthropic Messages endpoint (NOT OpenAI-compatible).
 * Requires an API key and x-api-key + anthropic-version headers.
 * Model is user-configurable (e.g. claude-3-sonnet, claude-3-haiku).
 */

import type { LLMProvider, ConnectionTestResult } from '../types';

/** Current stable Anthropic API version. */
const ANTHROPIC_VERSION = '2023-06-01';

export class AnthropicProvider implements LLMProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generateText(prompt: string, signal?: AbortSignal): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Anthropic API key is not configured.');
    }
    if (!this.model) {
      throw new Error('Anthropic model is not configured.');
    }

    const response = await fetch(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
        }),
        signal,
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(
        `Anthropic request failed (${response.status}): ${errorText}`
      );
    }

    const data = await response.json();

    // Anthropic response format: { content: [{ type: "text", text: "..." }] }
    if (data.content && Array.isArray(data.content)) {
      const textBlocks = data.content.filter(
        (block: { type?: string }) => block.type === 'text'
      );
      return textBlocks.map((block: { text?: string }) => block.text ?? '').join('');
    }

    return '';
  }

  async testConnection(): Promise<ConnectionTestResult> {
    if (!this.apiKey) {
      return { success: false, message: 'API key is required. Enter your Anthropic API key above.' };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      // Anthropic doesn't have a lightweight /models endpoint,
      // so we send a minimal messages request to validate the key.
      const response = await fetch(
        'https://api.anthropic.com/v1/messages',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': ANTHROPIC_VERSION,
          },
          body: JSON.stringify({
            model: this.model || 'claude-3-sonnet-20240229',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'ping' }],
          }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeout);

      if (response.status === 401) {
        return { success: false, message: 'Invalid API key. Please check your Anthropic API key.' };
      }
      if (response.status === 403) {
        return { success: false, message: 'Access denied. Your API key may lack permissions for this model.' };
      }
      if (response.status === 404) {
        return { success: false, message: `Model "${this.model}" not found. Check the model name (e.g. claude-3-sonnet-20240229).` };
      }
      if (response.status === 429) {
        return { success: false, message: 'Rate limited. Your API key is valid but you have exceeded your quota.' };
      }
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        return { success: false, message: `Anthropic returned status ${response.status}.${errorText ? ' ' + errorText.slice(0, 100) : ''}` };
      }

      return {
        success: true,
        message: `Connected to Anthropic. Model: ${this.model || 'not set'}.`,
      };
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { success: false, message: 'Connection to Anthropic timed out. Check your network.' };
      }
      return { success: false, message: 'Cannot reach Anthropic. Check your network connection.' };
    }
  }
}
