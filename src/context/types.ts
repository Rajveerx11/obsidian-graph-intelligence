export type CompressionLevel = 'short' | 'medium' | 'detailed';

export type ContextFormat = 'json' | 'markdown' | 'text';

export interface ContextPack {
  metadata: {
    generatedAt: string;
    compressionLevel: CompressionLevel;
    format: ContextFormat;
    totalTokens: number;
    nodeCount: number;
    edgeCount: number;
  };
  overview: {
    totalNotes: number;
    totalConnections: number;
    clusterCount: number;
    orphanCount: number;
    knowledgeGaps: number;
    coverageEstimate: string;
  };
  clusters: ContextCluster[];
  keyNodes: ContextNode[];
  relationships: ContextRelationship[];
  gaps: ContextGap[];
  content: string;
}

export interface ContextCluster {
  id: string;
  size: number;
  summary: string;
  themes: string[];
  keyNotes: Array<{ id: string; title: string }>;
  connectionsToOtherClusters: number;
}

export interface ContextNode {
  id: string;
  title: string;
  type: 'hub' | 'bridge' | 'leaf';
  importance: number;
  connectionCount: number;
  tags: string[];
  summary?: string;
}

export interface ContextRelationship {
  source: string;
  target: string;
  type: 'explicit' | 'semantic' | 'inferred' | 'ai_generated';
  strength: number;
  explanation?: string;
}

export interface ContextGap {
  description: string;
  severity: 'high' | 'medium' | 'low';
  involvedClusters: string[];
}

export interface ContextCompressionConfig {
  level: CompressionLevel;
  format: ContextFormat;
  maxTokens: number;
  includeEmbeddings: boolean;
  includeRawContent: boolean;
  maxClusters: number;
  maxKeyNodes: number;
  maxRelationships: number;
}

export const DEFAULT_COMPRESSION_CONFIG: ContextCompressionConfig = {
  level: 'medium',
  format: 'json',
  maxTokens: 4000,
  includeEmbeddings: false,
  includeRawContent: false,
  maxClusters: 10,
  maxKeyNodes: 20,
  maxRelationships: 50,
};

export const TOKEN_BUDGETS: Record<CompressionLevel, number> = {
  short: 1000,
  medium: 3000,
  detailed: 6000,
};

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function truncateToTokens(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;
  return text.substring(0, maxChars - 3) + '...';
}
