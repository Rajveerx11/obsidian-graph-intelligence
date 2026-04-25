export type UserActionType = 'accept' | 'create_note' | 'ignore';

export interface UserAction {
  type: UserActionType;
  /** Primary note involved in the action. */
  sourceNoteId?: string;
  /** Secondary note involved in the action. */
  targetNoteId?: string;
  /** Multiple notes involved, if applicable. */
  noteIds?: string[];
  /** When the action occurred. */
  timestamp: number;
}

export interface LearningData {
  /** 
   * Weights assigned to specific nodes based on user interaction.
   * Positive means user engages with it (links, creates).
   * Negative means user ignores suggestions related to it.
   */
  nodeWeights: Record<string, number>;
  
  /** History of recent actions. */
  actionHistory: UserAction[];
}

export const DEFAULT_LEARNING_DATA: LearningData = {
  nodeWeights: {},
  actionHistory: [],
};
