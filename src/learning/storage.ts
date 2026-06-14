import type { App } from 'obsidian';
import { DEFAULT_LEARNING_DATA, LearningData } from './learningTypes';
import { pluginFilePath, loadJson, saveJson } from '../persistence';

const LEARNING_FILENAME = 'learning.json';

/** Shape-validate parsed learning data, coercing missing fields to defaults. */
function validateLearningData(parsed: unknown): LearningData | null {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    console.warn('[ogi:learning] Learning data has unexpected shape, returning default.');
    return null;
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
}

export async function loadLearningData(app: App): Promise<LearningData> {
  const path = pluginFilePath(app, LEARNING_FILENAME);
  const data = await loadJson(app, path, validateLearningData);
  return data ?? { ...DEFAULT_LEARNING_DATA };
}

export async function saveLearningData(app: App, data: LearningData): Promise<void> {
  const path = pluginFilePath(app, LEARNING_FILENAME);
  await saveJson(app, path, data, true);
}
