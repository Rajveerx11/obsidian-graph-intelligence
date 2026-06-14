/**
 * Ollama Provider — Local LLM via REST API
 *
 * Connects to a locally running Ollama instance.
 * No API key required. Model is user-configurable (free text).
 * Does NOT validate model at startup — the user can input any model name.
 */

import type { LLMProvider, ConnectionTestResult } from '../types';
import { fetchWithTimeout, isAbortError, throwIfNotOk } from './httpClient';

export class OllamaProvider implements LLMProvider {
  private baseUrl: string;
  private model: string;

  constructor(baseUrl: string, model: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.model = model;
  }

  async generateText(prompt: string, signal?: AbortSignal): Promise<string> {
    if (!this.model) {
      throw new Error('Ollama model is not configured. Please enter a model name in settings.');
    }

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

    await throwIfNotOk(response, 'Ollama');

    const data = await response.json();
    return data.response ?? '';
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      // Step 1: Check if Ollama server is reachable
      const response = await fetchWithTimeout(`${this.baseUrl}/api/tags`, {}, 5000);

      if (!response.ok) {
        return {
          success: false,
          message: `Ollama server returned status ${response.status}. Ensure Ollama is running at ${this.baseUrl}.`,
        };
      }

      // Step 2: Optionally verify the model exists (informational, not blocking)
      if (this.model) {
        const data = await response.json();
        const models: string[] = (data.models ?? []).map(
          (m: { name?: string }) => m.name?.split(':')[0] ?? ''
        );
        if (models.length > 0 && !models.some((m) => m === this.model || m.startsWith(this.model))) {
          return {
            success: true,
            message: `Connected to Ollama, but model "${this.model}" was not found locally. Available: ${models.slice(0, 5).join(', ')}. You can still use it if you pull it first.`,
          };
        }
      }

      return {
        success: true,
        message: `Connected to Ollama at ${this.baseUrl}.${this.model ? ` Model "${this.model}" is available.` : ''}`,
      };
    } catch (err) {
      if (isAbortError(err)) {
        return {
          success: false,
          message: `Connection to Ollama timed out. Ensure Ollama is running at ${this.baseUrl}.`,
        };
      }
      return {
        success: false,
        message: `Cannot reach Ollama at ${this.baseUrl}. Is the server running?`,
      };
    }
  }
}
