import type { App } from 'obsidian';
import { DEFAULT_LEARNING_DATA, LearningData } from './learningTypes';

const LEARNING_FILE_PATH = '.obsidian/plugins/graph-intelligence/learning.json';

export async function loadLearningData(app: App): Promise<LearningData> {
  const adapter = app.vault.adapter;
  if (await adapter.exists(LEARNING_FILE_PATH)) {
    try {
      const content = await adapter.read(LEARNING_FILE_PATH);
      const data = JSON.parse(content) as Partial<LearningData>;
      return {
        nodeWeights: data.nodeWeights ?? {},
        actionHistory: data.actionHistory ?? [],
      };
    } catch (e) {
      console.warn('[ogi:learning] Failed to parse learning data, returning default.', e);
    }
  }
  return { ...DEFAULT_LEARNING_DATA };
}

export async function saveLearningData(app: App, data: LearningData): Promise<void> {
  const adapter = app.vault.adapter;
  try {
    const json = JSON.stringify(data, null, 2);
    // Ensure the plugin config directory exists (it should, but just in case)
    const configDir = app.vault.configDir || '.obsidian';
    const pluginDir = `${configDir}/plugins/graph-intelligence`;
    if (!(await adapter.exists(pluginDir))) {
      await adapter.mkdir(pluginDir);
    }
    await adapter.write(LEARNING_FILE_PATH, json);
  } catch (e) {
    console.error('[ogi:learning] Failed to save learning data.', e);
  }
}
