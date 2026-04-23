/**
 * OpenAI Provider — Cloud LLM via REST API
 *
 * Uses the OpenAI Chat Completions endpoint.
 * Requires an API key configured by the user.
 */

import type { LLMProvider } from '../types';

export class OpenAIProvider implements LLMProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generateText(prompt: string, signal?: AbortSignal): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key is not configured.');
    }

    const response = await fetch(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
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
        `OpenAI request failed (${response.status}): ${errorText}`
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

      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: controller.signal,
      });

      clearTimeout(timeout);
      return response.ok;
    } catch {
      return false;
    }
  }
}
