import type { App } from 'obsidian';
import { LearningData, UserAction, DEFAULT_LEARNING_DATA } from './learningTypes';
import { loadLearningData, saveLearningData } from './storage';

const MAX_WEIGHT = 0.2; // Maximum weight an item can gain
const MIN_WEIGHT = -0.1; // Minimum weight an item can have
const POSITIVE_INCREMENT = 0.05;
const NEGATIVE_INCREMENT = -0.02;

export class LearningEngine {
  private app: App;
  private data: LearningData;
  private isLoaded: boolean = false;

  constructor(app: App) {
    this.app = app;
    this.data = { ...DEFAULT_LEARNING_DATA };
  }

  /** Load learning data from disk. */
  async load(): Promise<void> {
    this.data = await loadLearningData(this.app);
    this.isLoaded = true;
  }

  /** Check if the engine has loaded data yet. */
  get ready(): boolean {
    return this.isLoaded;
  }

  /** Get a readonly copy of the current learning data. */
  getLearningData(): LearningData {
    return this.data;
  }

  /** Record a user action, update weights, and save. */
  async recordAction(action: UserAction): Promise<void> {
    if (!this.isLoaded) await this.load();

    // 1. Add to history
    this.data.actionHistory.push(action);
    // Keep history bounded to last 100 actions
    if (this.data.actionHistory.length > 100) {
      this.data.actionHistory.shift();
    }

    // 2. Adjust weights
    const notesToAdjust = new Set<string>();
    if (action.sourceNoteId) notesToAdjust.add(action.sourceNoteId);
    if (action.targetNoteId) notesToAdjust.add(action.targetNoteId);
    if (action.noteIds) action.noteIds.forEach(id => notesToAdjust.add(id));

    const adjustment = action.type === 'ignore' ? NEGATIVE_INCREMENT : POSITIVE_INCREMENT;

    for (const noteId of notesToAdjust) {
      const currentWeight = this.data.nodeWeights[noteId] || 0;
      let newWeight = currentWeight + adjustment;
      
      // Clamp between MIN_WEIGHT and MAX_WEIGHT
      newWeight = Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, newWeight));
      this.data.nodeWeights[noteId] = newWeight;
    }

    // 3. Save to disk
    await saveLearningData(this.app, this.data);
  }

  /** Reset learning data completely. */
  async reset(): Promise<void> {
    this.data = { nodeWeights: {}, actionHistory: [] };
    await saveLearningData(this.app, this.data);
  }

  // ── Pure-ish Helper Methods for Adapting Scores ──────────────────────

  /**
   * Adjusts a similarity score based on learned weights.
   * If the user frequently links nodes, their combined weight will give a small boost.
   */
  static adjustSimilarity(baseSimilarity: number, noteAId: string, noteBId: string, data: LearningData): number {
    const weightA = data.nodeWeights[noteAId] || 0;
    const weightB = data.nodeWeights[noteBId] || 0;
    
    // Example: if A and B both have max weight (+0.2 each), 
    // we boost similarity by (+0.4 * 0.15) = +0.06
    const adjustment = Math.max(0, (weightA + weightB) * 0.15); 
    
    return Math.max(0, Math.min(1, baseSimilarity + adjustment));
  }

  /**
   * Adjusts a confidence score for a gap based on learned weights.
   * Averages the weights of the involved notes to determine the adjustment.
   */
  static adjustConfidence(baseConfidence: number, involvedNotes: string[], data: LearningData): number {
    if (involvedNotes.length === 0) return baseConfidence;

    let totalWeight = 0;
    for (const id of involvedNotes) {
      totalWeight += (data.nodeWeights[id] || 0);
    }
    const avgWeight = totalWeight / involvedNotes.length;
    
    // Max average weight is +0.2. This would yield a +0.1 confidence boost.
    const adjustment = avgWeight * 0.5;
    
    return Math.max(0, Math.min(1, baseConfidence + adjustment));
  }
}
