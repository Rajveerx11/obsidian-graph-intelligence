export type MCPTool =
  | 'get_clusters'
  | 'get_orphans'
  | 'get_similar_notes'
  | 'get_knowledge_gaps'
  | 'query_graph_summary'
  | 'get_node_context'
  | 'get_connected_notes'
  | 'search_by_tag'
  | 'get_cluster_bridge_candidates';

export interface MCPRequest {
  tool: MCPTool;
  params: Record<string, unknown>;
  requestId: string;
  maxTokens?: number;
}

export interface MCPResponse {
  requestId: string;
  success: boolean;
  data: unknown;
  error?: string;
  estimatedTokens?: number;
}

export interface MCPCluster {
  id: string;
  size: number;
  nodeIds: string[];
  sampleTitles: string[];
  dominantTags: string[];
  summary: string;
}

export interface MCPOrphan {
  id: string;
  title: string;
  wordCount: number;
  createdAt?: string;
}

export interface MCPSimilarNote {
  id: string;
  title: string;
  similarity: number;
  connectionPath?: string[];
  sharedTags: string[];
}

export interface MCPKnowledgeGap {
  id: string;
  description: string;
  involvedNoteIds: string[];
  confidence: number;
  suggestedAction: string;
}

export interface MCPGraphSummary {
  totalNodes: number;
  totalEdges: number;
  clusterCount: number;
  orphanCount: number;
  gapCount: number;
  edgeTypeDistribution: Record<string, number>;
  topTags: Array<{ tag: string; count: number }>;
  mostConnectedNodes: Array<{ id: string; title: string; connections: number }>;
}

export interface MCPNodeContext {
  id: string;
  title: string;
  type: string;
  tags: string[];
  outgoingLinks: string[];
  incomingLinks: string[];
  clusterId?: string;
  similarNotes: MCPSimilarNote[];
  contentPreview?: string;
}

export interface MCPBridgeCandidate {
  clusterA: string;
  clusterB: string;
  clusterASize: number;
  clusterBSize: number;
  candidatePairs: Array<{
    nodeA: { id: string; title: string };
    nodeB: { id: string; title: string };
    similarity: number;
    reason: string;
  }>;
}

export interface MCPConfig {
  enabled: boolean;
  port?: number;
  maxResponseTokens: number;
  enabledTools: MCPTool[];
  rateLimitPerMinute: number;
  requireConfirmation: boolean;
}

export const DEFAULT_MCP_CONFIG: MCPConfig = {
  enabled: false,
  maxResponseTokens: 4000,
  enabledTools: [
    'get_clusters',
    'get_orphans',
    'get_similar_notes',
    'get_knowledge_gaps',
    'query_graph_summary',
    'get_node_context',
    'get_connected_notes',
    'search_by_tag',
  ],
  rateLimitPerMinute: 60,
  requireConfirmation: true,
};

export interface RateLimitState {
  requests: number[];
}
