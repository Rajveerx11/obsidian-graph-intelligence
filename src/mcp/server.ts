import type { MCPConfig, MCPRequest, MCPResponse, RateLimitState } from './types';
import { handleMCPQuery, type QueryEngineContext as Context } from './queryEngine';

export class MCPServer {
  private config: MCPConfig;
  private rateLimitState: RateLimitState;
  private context: Context | null = null;

  constructor(config: MCPConfig) {
    this.config = config;
    this.rateLimitState = {
      requests: [],
    };
  }

  setContext(context: Context): void {
    this.context = context;
  }

  updateConfig(config: MCPConfig): void {
    this.config = config;
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  private checkRateLimit(): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    const windowMs = 60000;
    const maxRequests = this.config.rateLimitPerMinute;

    this.rateLimitState.requests = this.rateLimitState.requests.filter(
      ts => now - ts < windowMs
    );

    if (this.rateLimitState.requests.length >= maxRequests) {
      const oldestRequest = this.rateLimitState.requests[0];
      const retryAfter = Math.ceil((oldestRequest + windowMs - now) / 1000);
      return { allowed: false, retryAfter };
    }

    this.rateLimitState.requests.push(now);
    return { allowed: true };
  }

  async processRequest(request: MCPRequest): Promise<MCPResponse> {
    if (!this.config.enabled) {
      return {
        requestId: request.requestId,
        success: false,
        data: null,
        error: 'MCP is not enabled. Enable it in plugin settings.',
      };
    }

    const rateLimit = this.checkRateLimit();
    if (!rateLimit.allowed) {
      return {
        requestId: request.requestId,
        success: false,
        data: null,
        error: `Rate limit exceeded. Try again in ${rateLimit.retryAfter} seconds.`,
      };
    }

    if (!this.context) {
      return {
        requestId: request.requestId,
        success: false,
        data: null,
        error: 'Graph context not available. Please refresh the graph analysis.',
      };
    }

    return await handleMCPQuery(request, this.context, this.config);
  }

  async processBatch(requests: MCPRequest[]): Promise<MCPResponse[]> {
    const responses: MCPResponse[] = [];
    
    for (const request of requests) {
      const response = await this.processRequest(request);
      responses.push(response);
    }

    return responses;
  }

  getToolSchemas(): Array<{ tool: string; description: string; params: Record<string, unknown> }> {
    return [
      {
        tool: 'get_clusters',
        description: 'Returns knowledge clusters with summaries and dominant themes',
        params: {},
      },
      {
        tool: 'get_orphans',
        description: 'Returns disconnected notes that have no links',
        params: {},
      },
      {
        tool: 'get_similar_notes',
        description: 'Finds semantically similar notes to a given note',
        params: {
          noteId: 'string - ID of the source note',
          threshold: 'number (optional) - Minimum similarity (0-1), default 0.75',
          topN: 'number (optional) - Maximum results, default 5',
        },
      },
      {
        tool: 'get_knowledge_gaps',
        description: 'Returns detected knowledge gaps and improvement suggestions',
        params: {},
      },
      {
        tool: 'query_graph_summary',
        description: 'Returns high-level graph statistics and overview',
        params: {},
      },
      {
        tool: 'get_node_context',
        description: 'Returns detailed context for a specific note',
        params: {
          noteId: 'string - ID of the note',
        },
      },
      {
        tool: 'get_connected_notes',
        description: 'Returns notes connected to a given note',
        params: {
          noteId: 'string - ID of the note',
          maxHops: 'number (optional) - Connection depth, default 2',
        },
      },
      {
        tool: 'search_by_tag',
        description: 'Finds all notes with a specific tag',
        params: {
          tag: 'string - Tag to search for',
        },
      },
      {
        tool: 'get_cluster_bridge_candidates',
        description: 'Finds potential connections between different clusters',
        params: {
          minSimilarity: 'number (optional) - Minimum similarity threshold, default 0.6',
          maxPairs: 'number (optional) - Maximum bridge pairs per cluster pair, default 10',
        },
      },
    ];
  }
}

let serverInstance: MCPServer | null = null;

export function getMCPServer(config?: MCPConfig): MCPServer {
  if (!serverInstance && config) {
    serverInstance = new MCPServer(config);
  } else if (!serverInstance) {
    throw new Error('MCP server not initialized');
  }
  return serverInstance;
}

export function resetMCPServer(): void {
  serverInstance = null;
}
