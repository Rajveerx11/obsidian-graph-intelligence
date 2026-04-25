/**
 * Fix My Vault — Type Definitions
 *
 * Defines the unified data structures for actionable vault improvements.
 */

export type FixType = 'gap' | 'orphan' | 'link';
export type FixPriority = 'high' | 'medium' | 'low';
export type FixActionType = 'link' | 'create_note' | 'open';

export interface FixActionPayload {
  sourceId?: string;
  targetId?: string;
  noteIds?: string[];
}

export interface FixAction {
  label: string;
  actionType: FixActionType;
  payload: FixActionPayload;
}

export interface FixItem {
  /** Unique identifier for the fix. */
  id: string;
  /** Short, actionable title. */
  title: string;
  /** Explanation of the issue and why it should be fixed. */
  description: string;
  /** The category of the fix. */
  type: FixType;
  /** The importance/urgency of the fix. */
  priority: FixPriority;
  /** Confidence score (0 to 1). */
  confidence: number;
  /** The action to be taken to resolve the fix. */
  action: FixAction;
}
