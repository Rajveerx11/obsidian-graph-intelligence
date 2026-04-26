import type { App } from 'obsidian';
import { DEFAULT_LEARNING_DATA, LearningData } from './learningTypes';

const LEARNING_FILE_PATH = '.obsidian/plugins/graph-intelligence/learning.json';

export async function loadLearningData(app: App): Promise<LearningData> {
  const adapter = app.vault.adapter;
  if (await adapter.exists(LEARNING_FILE_PATH)) {
    try {
      const content = await adapter.read(LEARNING_FILE_PATH);
      const parsed: unknown = JSON.parse(content);

      // Guard: must be a plain, non-array object
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        console.warn('[ogi:learning] Learning data has unexpected shape, returning default.');
        return { ...DEFAULT_LEARNING_DATA };
      }

      const data = parsed as Record<string, unknown>;

      // Validate nodeWeights: must be a plain object (not array)
      const nodeWeights: Record<string, number> =
        data.nodeWeights !== null &&
        typeof data.nodeWeights === 'object' &&
        !Array.isArray(data.nodeWeights)
          ? (data.nodeWeights as Record<string, number>)
          : {};

      // Validate actionHistory: must be an array
      const actionHistory = Array.isArray(data.actionHistory)
        ? (data.actionHistory as LearningData['actionHistory'])
        : [];

      return { nodeWeights, actionHistory };
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
