/**
 * LLM Settings Panel — Provider configuration UI.
 *
 * Features:
 *  - Provider selector (Ollama / OpenAI / OpenRouter / Anthropic)
 *  - Dynamic form fields based on selected provider
 *  - Password-masked API key inputs
 *  - Test Connection button with structured success/error messages
 *  - Fully controlled component (state managed by parent)
 */

import { useState } from 'react';
import { Wifi, WifiOff, Loader2, CheckCircle, XCircle } from 'lucide-react';
import type { LLMSettingsPanelProps } from './types';
import type { LLMProviderType, LLMSettings } from '../llm/types';

/** Display labels for each provider type. */
const PROVIDER_LABELS: Record<LLMProviderType, string> = {
  ollama: 'Ollama (Local)',
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
  anthropic: 'Anthropic',
};

export function LLMSettingsPanel({
  settings,
  onChange,
  onTestConnection,
}: LLMSettingsPanelProps) {
  const [testStatus, setTestStatus] = useState<
    'idle' | 'testing' | 'success' | 'failure'
  >('idle');
  const [testMessage, setTestMessage] = useState('');

  const update = (partial: Partial<LLMSettings>) => {
    onChange({ ...settings, ...partial });
  };

  const handleTestConnection = async () => {
    if (!onTestConnection) return;
    setTestStatus('testing');
    setTestMessage('');
    try {
      const result = await onTestConnection();
      setTestStatus(result.success ? 'success' : 'failure');
      setTestMessage(result.message);
    } catch {
      setTestStatus('failure');
      setTestMessage('Connection test failed unexpectedly.');
    }
    // Auto-reset after 6 seconds
    setTimeout(() => {
      setTestStatus('idle');
      setTestMessage('');
    }, 6000);
  };

  return (
    <div className="ogi-settings-panel">
      <div className="ogi-settings-fields">
        {/* Provider Selector */}
        <div className="ogi-settings-field">
          <label className="ogi-settings-label">Provider</label>
          <div className="ogi-settings-radio-group">
            {(
              ['ollama', 'openai', 'openrouter', 'anthropic'] as LLMProviderType[]
            ).map((p) => (
              <label key={p} className="ogi-settings-radio">
                <input
                  type="radio"
                  name="llm-provider"
                  value={p}
                  checked={settings.provider === p}
                  onChange={() => update({ provider: p })}
                />
                <span className="ogi-settings-radio-label">
                  {PROVIDER_LABELS[p]}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* ── Ollama Settings ────────────────────────────────────────── */}
        {settings.provider === 'ollama' && (
          <>
            <div className="ogi-settings-field">
              <label className="ogi-settings-label">Base URL</label>
              <input
                type="text"
                className="ogi-settings-input"
                value={settings.ollamaBaseUrl}
                onChange={(e) => update({ ollamaBaseUrl: e.target.value })}
                placeholder="http://localhost:11434"
              />
            </div>
            <div className="ogi-settings-field">
              <label className="ogi-settings-label">Model</label>
              <input
                type="text"
                className="ogi-settings-input"
                value={settings.ollamaModel}
                onChange={(e) => update({ ollamaModel: e.target.value })}
                placeholder="llama3.2"
              />
              <span className="ogi-settings-hint">
                Enter any model name you have pulled locally.
              </span>
            </div>
          </>
        )}

        {/* ── OpenAI Settings ────────────────────────────────────────── */}
        {settings.provider === 'openai' && (
          <>
            <div className="ogi-settings-field">
              <label className="ogi-settings-label">API Key</label>
              <input
                type="password"
                className="ogi-settings-input"
                value={settings.openaiApiKey}
                onChange={(e) => update({ openaiApiKey: e.target.value })}
                placeholder="sk-..."
                autoComplete="off"
              />
            </div>
            <div className="ogi-settings-field">
              <label className="ogi-settings-label">Model</label>
              <input
                type="text"
                className="ogi-settings-input"
                value={settings.openaiModel}
                onChange={(e) => update({ openaiModel: e.target.value })}
                placeholder="gpt-4o-mini"
              />
            </div>
          </>
        )}

        {/* ── OpenRouter Settings ────────────────────────────────────── */}
        {settings.provider === 'openrouter' && (
          <>
            <div className="ogi-settings-field">
              <label className="ogi-settings-label">API Key</label>
              <input
                type="password"
                className="ogi-settings-input"
                value={settings.openrouterApiKey}
                onChange={(e) => update({ openrouterApiKey: e.target.value })}
                placeholder="sk-or-..."
                autoComplete="off"
              />
            </div>
            <div className="ogi-settings-field">
              <label className="ogi-settings-label">Model</label>
              <input
                type="text"
                className="ogi-settings-input"
                value={settings.openrouterModel}
                onChange={(e) => update({ openrouterModel: e.target.value })}
                placeholder="meta-llama/llama-3.1-8b-instruct:free"
              />
            </div>
          </>
        )}

        {/* ── Anthropic Settings ─────────────────────────────────────── */}
        {settings.provider === 'anthropic' && (
          <>
            <div className="ogi-settings-field">
              <label className="ogi-settings-label">API Key</label>
              <input
                type="password"
                className="ogi-settings-input"
                value={settings.anthropicApiKey}
                onChange={(e) => update({ anthropicApiKey: e.target.value })}
                placeholder="sk-ant-..."
                autoComplete="off"
              />
            </div>
            <div className="ogi-settings-field">
              <label className="ogi-settings-label">Model</label>
              <input
                type="text"
                className="ogi-settings-input"
                value={settings.anthropicModel}
                onChange={(e) => update({ anthropicModel: e.target.value })}
                placeholder="claude-3-sonnet-20240229"
              />
            </div>
          </>
        )}

        {/* ── Test Connection ────────────────────────────────────────── */}
        {onTestConnection && (
          <div className="ogi-settings-field">
            <button
              className={`ogi-btn ogi-btn--test ${
                testStatus === 'success'
                  ? 'ogi-btn--test-success'
                  : testStatus === 'failure'
                    ? 'ogi-btn--test-failure'
                    : ''
              }`}
              onClick={handleTestConnection}
              disabled={testStatus === 'testing'}
            >
              {testStatus === 'testing' && <Loader2 className="ogi-spin" />}
              {testStatus === 'success' && <CheckCircle />}
              {testStatus === 'failure' && <XCircle />}
              {testStatus === 'idle' && <Wifi />}
              {testStatus === 'testing'
                ? 'Testing...'
                : testStatus === 'success'
                  ? 'Connected!'
                  : testStatus === 'failure'
                    ? 'Failed'
                    : 'Test Connection'}
            </button>

            {/* Structured message display */}
            {testMessage && testStatus !== 'idle' && (
              <div
                className={`ogi-settings-test-message ${
                  testStatus === 'success'
                    ? 'ogi-settings-test-message--success'
                    : 'ogi-settings-test-message--failure'
                }`}
              >
                {testMessage}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
