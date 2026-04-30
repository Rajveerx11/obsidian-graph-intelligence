export interface IngestedEntity {
  id: string;
  title: string;
  sourceType: IngestionSourceType;
  sourcePath: string;
  content: string;
  mtime: number;
  metadata: Record<string, unknown>;
  tags: string[];
}

export type IngestionSourceType = 'pdf' | 'image' | 'youtube' | 'text' | 'markdown';

export type IngestionStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface IngestionConfig {
  maxFileSizeMB: number;
  batchSize: number;
  batchDelayMs: number;
  lazyProcessing: boolean;
}

export const DEFAULT_INGESTION_CONFIG: IngestionConfig = {
  maxFileSizeMB: 50,
  batchSize: 5,
  batchDelayMs: 100,
  lazyProcessing: true,
};

export type IngestionProgressCallback = (progress: {
  current: number;
  total: number;
  currentFile?: string;
  status: IngestionStatus;
}) => void;
