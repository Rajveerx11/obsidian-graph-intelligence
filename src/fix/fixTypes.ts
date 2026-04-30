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
  id: string;
  title: string;
  description: string;
  type: FixType;
  priority: FixPriority;
  confidence: number;
  action: FixAction;
}

export interface FixBatchItemResult {
  fixId: string;
  success: boolean;
  message: string;
}

export interface FixBatchResult {
  success: boolean;
  message: string;
  results: FixBatchItemResult[];
}
