/**
 * OpenRouter Provider — Cloud LLM via OpenAI-compatible REST API
 *
 * Uses the OpenRouter Chat Completions endpoint.
 * Requires an API key. Sends required HTTP-Referer and X-Title headers.
 */

import type { LLMProvider } from '../types';

export class OpenRouterProvider implements LLMProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generateText(prompt: string, signal?: AbortSignal): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key is not configured.');
    }

    const response = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://github.com/obsidian-graph-intelligence',
          'X-Title': 'Obsidian Graph Intelligence',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 1024,
        }),
        signal,
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(
        `OpenRouter request failed (${response.status}): ${errorText}`
      );
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? '';
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) return false;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(
        'https://openrouter.ai/api/v1/models',
        {
          headers: { Authorization: `Bearer ${this.apiKey}` },
          signal: controller.signal,
        }
      );

      clearTimeout(timeout);
      return response.ok;
    } catch {
      return false;
    }
  }
}
