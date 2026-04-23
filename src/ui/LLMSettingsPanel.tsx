/**
 * LLM Settings Panel — Provider configuration UI.
 *
 * Features:
 *  - Provider selector (Ollama / OpenAI / OpenRouter)
 *  - Conditional fields based on provider
 *  - Password-masked API key inputs
 *  - Test Connection button
 *  - Fully controlled component (state managed by parent)
 */

import { useState } from 'react';
import { Settings, Wifi, WifiOff, Loader2 } from 'lucide-react';
import type { LLMSettingsPanelProps } from './types';
import type { LLMProviderType, LLMSettings } from '../llm/types';

export function LLMSettingsPanel({
  settings,
  onChange,
  onTestConnection,
}: LLMSettingsPanelProps) {
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failure'>('idle');

  const update = (partial: Partial<LLMSettings>) => {
    onChange({ ...settings, ...partial });
  };

  const handleTestConnection = async () => {
    if (!onTestConnection) return;
    setTestStatus('testing');
    try {
      const ok = await onTestConnection();
      setTestStatus(ok ? 'success' : 'failure');
    } catch {
      setTestStatus('failure');
    }
    // Reset status after 3 seconds
    setTimeout(() => setTestStatus('idle'), 3000);
  };

  return (
    <div className="ogi-card ogi-settings-panel">
      <div className="ogi-card-header">
        <h3 className="ogi-card-title ogi-card-title--primary">
          <Settings />
          LLM Settings
        </h3>
      </div>

      <div className="ogi-card-body ogi-card-body--padded">
        {/* Provider Selector */}
        <div className="ogi-settings-field">
          <label className="ogi-settings-label">Provider</label>
          <div className="ogi-settings-radio-group">
            {(['ollama', 'openai', 'openrouter'] as LLMProviderType[]).map(
              (p) => (
                <label key={p} className="ogi-settings-radio">
                  <input
                    type="radio"
                    name="llm-provider"
                    value={p}
                    checked={settings.provider === p}
                    onChange={() => update({ provider: p })}
                  />
                  <span className="ogi-settings-radio-label">
                    {p === 'ollama' ? 'Ollama (Local)' : p === 'openai' ? 'OpenAI' : 'OpenRouter'}
                  </span>
                </label>
              )
            )}
          </div>
        </div>

        {/* Ollama Settings */}
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
            </div>
          </>
        )}

        {/* OpenAI Settings */}
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

        {/* OpenRouter Settings */}
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

        {/* Test Connection */}
        {onTestConnection && (
          <div className="ogi-settings-field">
            <button
              className="ogi-btn ogi-btn--test"
              onClick={handleTestConnection}
              disabled={testStatus === 'testing'}
            >
              {testStatus === 'testing' && <Loader2 className="ogi-spin" />}
              {testStatus === 'success' && <Wifi />}
              {testStatus === 'failure' && <WifiOff />}
              {testStatus === 'idle' && <Wifi />}
              {testStatus === 'testing'
                ? 'Testing...'
                : testStatus === 'success'
                  ? 'Connected!'
                  : testStatus === 'failure'
                    ? 'Failed'
                    : 'Test Connection'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
