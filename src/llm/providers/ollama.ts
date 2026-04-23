/**
 * Ollama Provider — Local LLM via REST API
 *
 * Connects to a locally running Ollama instance.
 * No API key required. Default: http://localhost:11434
 */

import type { LLMProvider } from '../types';

export class OllamaProvider implements LLMProvider {
  private baseUrl: string;
  private model: string;

  constructor(baseUrl: string, model: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.model = model;
  }

  async generateText(prompt: string, signal?: AbortSignal): Promise<string> {
    const url = `${this.baseUrl}/api/generate`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 1024,
        },
      }),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(
        `Ollama request failed (${response.status}): ${errorText}`
      );
    }

    const data = await response.json();
    return data.response ?? '';
  }

  async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: controller.signal,
      });

      clearTimeout(timeout);
      return response.ok;
    } catch {
      return false;
    }
  }
}
