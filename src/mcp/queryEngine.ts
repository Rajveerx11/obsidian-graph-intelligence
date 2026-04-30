import type { App } from 'obsidian';
import type { NoteNode } from '../core/types';
import type { ConfidenceEdge } from '../graph/edgeConfidence';
import type { KnowledgeGap } from '../gap/gapTypes';
import type {
  MCPRequest,
  MCPResponse,
  MCPCluster,
  MCPOrphan,
  MCPSimilarNote,
  MCPKnowledgeGap,
  MCPGraphSummary,
  MCPNodeContext,
  MCPBridgeCandidate,
  MCPConfig,
} from './types';
import { cosineSimilarity } from '../semantic/similarity';
import { groupEdgesByType } from '../graph/edgeConfidence';

export interface QueryEngineContext {
  app: App;
  nodes: NoteNode[];
  edges: ConfidenceEdge[];
  clusters: string[][];
  orphans: NoteNode[];
  gaps: KnowledgeGap[];
  embeddings: Map<string, number[]>;
}

export async function handleMCPQuery(
  request: MCPRequest,
  context: QueryEngineContext,
  config: MCPConfig
): Promise<MCPResponse> {

  if (!config.enabledTools.includes(request.tool)) {
    return {
      requestId: request.requestId,
      success: false,
      data: null,
      error: `Tool '${request.tool}' is not enabled`,
    };
  }

  const maxTokens = request.maxTokens || config.maxResponseTokens;

  try {
    let result: unknown;

    switch (request.tool) {
      case 'get_clusters':
        result = await handleGetClusters(context, maxTokens);
        break;
      case 'get_orphans':
        result = await handleGetOrphans(context, maxTokens);
        break;
      case 'get_similar_notes':
        result = await handleGetSimilarNotes(request.params, context, maxTokens);
        break;
      case 'get_knowledge_gaps':
        result = await handleGetKnowledgeGaps(context, maxTokens);
        break;
      case 'query_graph_summary':
        result = await handleGraphSummary(context);
        break;
      case 'get_node_context':
        result = await handleGetNodeContext(request.params, context, maxTokens);
        break;
      case 'get_connected_notes':
        result = await handleGetConnectedNotes(request.params, context, maxTokens);
        break;
      case 'search_by_tag':
        result = await handleSearchByTag(request.params, context, maxTokens);
        break;
      case 'get_cluster_bridge_candidates':
        result = await handleGetBridgeCandidates(request.params, context, maxTokens);
        break;
      default:
        return {
          requestId: request.requestId,
          success: false,
          data: null,
          error: `Unknown tool: ${request.tool}`,
        };
    }

    const jsonString = JSON.stringify(result);
    const estimatedTokens = Math.ceil(jsonString.length / 4);

    return {
      requestId: request.requestId,
      success: true,
      data: result,
      estimatedTokens,
    };
  } catch (err) {
    return {
      requestId: request.requestId,
      success: false,
      data: null,
      error: err instanceof Error ? err.message : 'Query failed',
    };
  }
}

async function handleGetClusters(
  context: QueryEngineContext,
  maxTokens: number
): Promise<{ clusters: MCPCluster[]; totalClusters: number }> {
  const clusters: MCPCluster[] = [];
  let tokenBudget = maxTokens;

  for (let i = 0; i < context.clusters.length; i++) {
    const clusterNodes = context.clusters[i];
    if (clusterNodes.length < 2) continue;

    const nodeObjects = clusterNodes
      .map(id => context.nodes.find(n => n.id === id))
      .filter((n): n is NoteNode => n !== undefined);

    const tagCounts: Record<string, number> = {};
    for (const node of nodeObjects) {
      for (const tag of node.tags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }

    const dominantTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag]) => tag);

    const cluster: MCPCluster = {
      id: `cluster-${i + 1}`,
      size: clusterNodes.length,
      nodeIds: clusterNodes.slice(0, 20),
      sampleTitles: nodeObjects.slice(0, 5).map(n => n.title),
      dominantTags,
      summary: `Cluster of ${clusterNodes.length} notes${dominantTags.length > 0 ? ` about ${dominantTags.join(', ')}` : ''}`,
    };

    clusters.push(cluster);

    const clusterTokens = JSON.stringify(cluster).length / 4;
    tokenBudget -= clusterTokens;
    if (tokenBudget < 200) break;
  }

  return { clusters, totalClusters: context.clusters.length };
}

async function handleGetOrphans(
  context: QueryEngineContext,
  maxTokens: number
): Promise<{ orphans: MCPOrphan[]; totalOrphans: number }> {
  const orphans: MCPOrphan[] = context.orphans.slice(0, 50).map(node => ({
    id: node.id,
    title: node.title,
    wordCount: node.contentSnippet.split(/\s+/).length,
  }));

  return { orphans, totalOrphans: context.orphans.length };
}

async function handleGetSimilarNotes(
  params: Record<string, unknown>,
  context: QueryEngineContext,
  maxTokens: number
): Promise<{ noteId: string; similarNotes: MCPSimilarNote[] }> {
  const noteId = params.noteId as string;
  const threshold = (params.threshold as number) || 0.75;
  const topN = Math.min(params.topN as number || 5, 10);

  const sourceNode = context.nodes.find(n => n.id === noteId);
  if (!sourceNode) {
    throw new Error(`Note not found: ${noteId}`);
  }

  const sourceEmbedding = context.embeddings.get(noteId);
  if (!sourceEmbedding) {
    return { noteId, similarNotes: [] };
  }

  const similarNotes: MCPSimilarNote[] = [];

  for (const [targetId, targetEmbedding] of context.embeddings.entries()) {
    if (targetId === noteId) continue;

    const score = cosineSimilarity(sourceEmbedding, targetEmbedding);
    if (score >= threshold) {
      const targetNode = context.nodes.find(n => n.id === targetId);
      if (targetNode) {
        similarNotes.push({
          id: targetId,
          title: targetNode.title,
          similarity: Number(score.toFixed(3)),
          sharedTags: targetNode.tags.filter(t => sourceNode.tags.includes(t)),
        });
      }
    }
  }

  similarNotes.sort((a, b) => b.similarity - a.similarity);

  return {
    noteId,
    similarNotes: similarNotes.slice(0, topN),
  };
}

async function handleGetKnowledgeGaps(
  context: QueryEngineContext,
  maxTokens: number
): Promise<{ gaps: MCPKnowledgeGap[]; totalGaps: number }> {
  const gaps: MCPKnowledgeGap[] = context.gaps.slice(0, 20).map(gap => ({
    id: gap.id,
    description: gap.description,
    involvedNoteIds: gap.involvedNotes.slice(0, 5),
    confidence: gap.confidence,
    suggestedAction: `${gap.suggestedAction.type}: ${gap.suggestedAction.details}`,
  }));

  return { gaps, totalGaps: context.gaps.length };
}

async function handleGraphSummary(context: QueryEngineContext): Promise<MCPGraphSummary> {
  const edgeTypes = groupEdgesByType(context.edges);

  const tagCounts: Record<string, number> = {};
  for (const node of context.nodes) {
    for (const tag of node.tags) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }

  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }));

  const connectionCounts = new Map<string, number>();
  for (const edge of context.edges) {
    connectionCounts.set(edge.source, (connectionCounts.get(edge.source) || 0) + 1);
    connectionCounts.set(edge.target, (connectionCounts.get(edge.target) || 0) + 1);
  }

  const mostConnected = Array.from(connectionCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, connections]) => {
      const node = context.nodes.find(n => n.id === id);
      return {
        id,
        title: node?.title || id,
        connections,
      };
    });

  return {
    totalNodes: context.nodes.length,
    totalEdges: context.edges.length,
    clusterCount: context.clusters.filter(c => c.length > 1).length,
    orphanCount: context.orphans.length,
    gapCount: context.gaps.length,
    edgeTypeDistribution: {
      explicit: edgeTypes.explicit.length,
      semantic: edgeTypes.semantic.length,
      inferred: edgeTypes.inferred.length,
      ai_generated: edgeTypes.ai_generated.length,
    },
    topTags,
    mostConnectedNodes: mostConnected,
  };
}

async function handleGetNodeContext(
  params: Record<string, unknown>,
  context: QueryEngineContext,
  maxTokens: number
): Promise<MCPNodeContext> {
  const noteId = params.noteId as string;
  const node = context.nodes.find(n => n.id === noteId);

  if (!node) {
    throw new Error(`Note not found: ${noteId}`);
  }

  const outgoingEdges = context.edges.filter(e => e.source === noteId);
  const incomingEdges = context.edges.filter(e => e.target === noteId);

  const outgoingTitles = outgoingEdges.map(e => {
    const target = context.nodes.find(n => n.id === e.target);
    return target?.title || e.target;
  });

  const incomingTitles = incomingEdges.map(e => {
    const source = context.nodes.find(n => n.id === e.source);
    return source?.title || e.source;
  });

  let clusterId: string | undefined;
  for (let i = 0; i < context.clusters.length; i++) {
    if (context.clusters[i].includes(noteId)) {
      clusterId = `cluster-${i + 1}`;
      break;
    }
  }

  const similarResult = await handleGetSimilarNotes(
    { noteId, threshold: 0.7, topN: 3 },
    context,
    500
  );

  let type = 'markdown';
  if (noteId.startsWith('youtube:')) type = 'youtube';
  else if (noteId.endsWith('.pdf')) type = 'pdf';
  else if (/\.(png|jpg|jpeg|gif|webp)$/i.test(noteId)) type = 'image';

  return {
    id: noteId,
    title: node.title,
    type,
    tags: node.tags,
    outgoingLinks: outgoingTitles.slice(0, 10),
    incomingLinks: incomingTitles.slice(0, 10),
    clusterId,
    similarNotes: similarResult.similarNotes,
    contentPreview: node.contentSnippet.substring(0, 200),
  };
}

async function handleGetConnectedNotes(
  params: Record<string, unknown>,
  context: QueryEngineContext,
  maxTokens: number
): Promise<{ noteId: string; directConnections: string[]; indirectConnections: string[] }> {
  const noteId = params.noteId as string;
  const maxHops = Math.min(params.maxHops as number || 2, 3);

  const direct = new Set<string>();
  const indirect = new Set<string>();

  for (const edge of context.edges) {
    if (edge.source === noteId) direct.add(edge.target);
    if (edge.target === noteId) direct.add(edge.source);
  }

  if (maxHops > 1) {
    const visited = new Set<string>([noteId, ...direct]);
    let frontier = new Set<string>(direct);

    for (let hop = 2; hop <= maxHops && frontier.size > 0; hop++) {
      const newFrontier = new Set<string>();

      for (const nodeId of frontier) {
        for (const edge of context.edges) {
          if (edge.source === nodeId && !visited.has(edge.target)) {
            newFrontier.add(edge.target);
            if (hop === 2) indirect.add(edge.target);
          }
          if (edge.target === nodeId && !visited.has(edge.source)) {
            newFrontier.add(edge.source);
            if (hop === 2) indirect.add(edge.source);
          }
        }
      }

      for (const id of newFrontier) {
        visited.add(id);
      }
      frontier = newFrontier;
    }
  }

  const directTitles = Array.from(direct).map(id => {
    const node = context.nodes.find(n => n.id === id);
    return node?.title || id;
  });

  const indirectTitles = Array.from(indirect).map(id => {
    const node = context.nodes.find(n => n.id === id);
    return node?.title || id;
  });

  return {
    noteId,
    directConnections: directTitles.slice(0, 20),
    indirectConnections: indirectTitles.slice(0, 20),
  };
}

async function handleSearchByTag(
  params: Record<string, unknown>,
  context: QueryEngineContext,
  maxTokens: number
): Promise<{ tag: string; matchingNotes: Array<{ id: string; title: string; otherTags: string[] }> }> {
  const tag = params.tag as string;
  const matchingNotes: Array<{ id: string; title: string; otherTags: string[] }> = [];

  for (const node of context.nodes) {
    if (node.tags.includes(tag)) {
      matchingNotes.push({
        id: node.id,
        title: node.title,
        otherTags: node.tags.filter(t => t !== tag),
      });
    }
  }

  return {
    tag,
    matchingNotes: matchingNotes.slice(0, 50),
  };
}

async function handleGetBridgeCandidates(
  params: Record<string, unknown>,
  context: QueryEngineContext,
  maxTokens: number
): Promise<MCPBridgeCandidate[]> {
  const minSimilarity = (params.minSimilarity as number) || 0.6;
  const maxPairs = Math.min(params.maxPairs as number || 10, 20);
  const candidates: MCPBridgeCandidate[] = [];

  for (let i = 0; i < context.clusters.length; i++) {
    for (let j = i + 1; j < context.clusters.length; j++) {
      const clusterA = context.clusters[i];
      const clusterB = context.clusters[j];

      if (clusterA.length < 2 || clusterB.length < 2) continue;

      const candidatePairs: MCPBridgeCandidate['candidatePairs'] = [];

      const sampleA = clusterA.slice(0, 10);
      const sampleB = clusterB.slice(0, 10);

      for (const nodeAId of sampleA) {
        const nodeA = context.nodes.find(n => n.id === nodeAId);
        const embeddingA = context.embeddings.get(nodeAId);
        if (!nodeA || !embeddingA) continue;

        for (const nodeBId of sampleB) {
          const nodeB = context.nodes.find(n => n.id === nodeBId);
          const embeddingB = context.embeddings.get(nodeBId);
          if (!nodeB || !embeddingB) continue;

          const similarity = cosineSimilarity(embeddingA, embeddingB);
          if (similarity >= minSimilarity) {
            candidatePairs.push({
              nodeA: { id: nodeAId, title: nodeA.title },
              nodeB: { id: nodeBId, title: nodeB.title },
              similarity: Number(similarity.toFixed(3)),
              reason: `Semantic similarity: ${(similarity * 100).toFixed(1)}%`,
            });
          }
        }
      }

      if (candidatePairs.length > 0) {
        candidatePairs.sort((a, b) => b.similarity - a.similarity);

        candidates.push({
          clusterA: `cluster-${i + 1}`,
          clusterB: `cluster-${j + 1}`,
          clusterASize: clusterA.length,
          clusterBSize: clusterB.length,
          candidatePairs: candidatePairs.slice(0, maxPairs),
        });
      }
    }
  }

  return candidates.slice(0, 10);
}
