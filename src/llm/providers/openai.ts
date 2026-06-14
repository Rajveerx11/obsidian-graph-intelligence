/**
 * OpenAI Provider — Cloud LLM via REST API
 *
 * Uses the OpenAI Chat Completions endpoint.
 * Requires an API key configured by the user.
 * Model is user-configurable (not hardcoded).
 */

import type { LLMProvider, ConnectionTestResult } from '../types';
import { fetchWithTimeout, isAbortError, throwIfNotOk } from './httpClient';

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
    if (!this.model) {
      throw new Error('OpenAI model is not configured.');
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

    await throwIfNotOk(response, 'OpenAI');

    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? '';
  }

  async testConnection(): Promise<ConnectionTestResult> {
    if (!this.apiKey) {
      return { success: false, message: 'API key is required. Enter your OpenAI API key above.' };
    }

    try {
      const response = await fetchWithTimeout(
        'https://api.openai.com/v1/models',
        { headers: { Authorization: `Bearer ${this.apiKey}` } },
        10000
      );

      if (response.status === 401) {
        return { success: false, message: 'Invalid API key. Please check your OpenAI API key.' };
      }
      if (response.status === 429) {
        return { success: false, message: 'Rate limited. Your API key is valid but you have exceeded your quota.' };
      }
      if (!response.ok) {
        return { success: false, message: `OpenAI returned status ${response.status}. Please try again.` };
      }

      return {
        success: true,
        message: `Connected to OpenAI. Model: ${this.model || 'not set'}.`,
      };
    } catch (err) {
      if (isAbortError(err)) {
        return { success: false, message: 'Connection to OpenAI timed out. Check your network.' };
      }
      return { success: false, message: 'Cannot reach OpenAI. Check your network connection.' };
    }
  }
}
