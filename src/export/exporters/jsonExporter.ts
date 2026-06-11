import type { NoteNode } from '../../core/types';
import type { ConfidenceEdge } from '../../graph/edgeConfidence';
import type { KnowledgeGap } from '../../gap/gapTypes';
import { countTags, rankByDegree, resolveNodes, topTagNames } from '../../graph/metrics';

export interface GraphJSONExport {
  exportInfo: {
    version: string;
    exportedAt: string;
    totalNodes: number;
    totalEdges: number;
    clusters: number;
    gaps: number;
  };
  nodes: Array<{
    id: string;
    title: string;
    type: 'markdown' | 'pdf' | 'image' | 'youtube' | 'text';
    tags: string[];
    outgoingLinks: string[];
    wordCount: number;
    clusterId?: string;
  }>;
  edges: Array<{
    source: string;
    target: string;
    type: 'explicit' | 'semantic' | 'inferred' | 'ai_generated';
    confidence: number;
    method: string;
    explanation?: string;
  }>;
  clusters: Array<{
    id: string;
    nodeIds: string[];
    nodeCount: number;
    dominantTags: string[];
  }>;
  orphans: string[];
  knowledgeGaps: Array<{
    id: string;
    type: 'cluster_gap' | 'orphan_gap' | 'concept_gap';
    description: string;
    involvedNotes: string[];
    confidence: number;
    suggestedAction: {
      type: 'link' | 'create_note';
      details: string;
    };
  }>;
  metadata: {
    topConnectedNodes: Array<{ id: string; title: string; connectionCount: number }>;
    tagDistribution: Record<string, number>;
    edgeTypeDistribution: Record<string, number>;
  };
}

export function exportToJSON(
  nodes: NoteNode[],
  edges: ConfidenceEdge[],
  clusters: string[][],
  orphans: NoteNode[],
  gaps: KnowledgeGap[]
): GraphJSONExport {

  const getNodeType = (id: string): GraphJSONExport['nodes'][0]['type'] => {
    if (id.startsWith('youtube:')) return 'youtube';
    if (id.endsWith('.pdf')) return 'pdf';
    const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
    if (imageExts.some(ext => id.toLowerCase().endsWith(ext))) return 'image';
    if (id.endsWith('.txt')) return 'text';
    return 'markdown';
  };

  const nodeClusterMap = new Map<string, string>();
  clusters.forEach((cluster, idx) => {
    cluster.forEach(nodeId => {
      nodeClusterMap.set(nodeId, `cluster-${idx + 1}`);
    });
  });

  const topConnected = rankByDegree(edges, 10).map(({ id, count }) => {
    const node = nodes.find(n => n.id === id);
    return {
      id,
      title: node?.title || id,
      connectionCount: count,
    };
  });

  const tagCounts = countTags(nodes);

  const edgeTypeCounts: Record<string, number> = {};
  for (const edge of edges) {
    edgeTypeCounts[edge.type] = (edgeTypeCounts[edge.type] || 0) + 1;
  }

  const clusterExports = clusters.map((cluster, idx) => {
    const dominantTags = topTagNames(resolveNodes(cluster, nodes), 5);

    return {
      id: `cluster-${idx + 1}`,
      nodeIds: cluster,
      nodeCount: cluster.length,
      dominantTags,
    };
  });

  return {
    exportInfo: {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      totalNodes: nodes.length,
      totalEdges: edges.length,
      clusters: clusters.length,
      gaps: gaps.length,
    },
    nodes: nodes.map(node => ({
      id: node.id,
      title: node.title,
      type: getNodeType(node.id),
      tags: node.tags,
      outgoingLinks: node.links,
      wordCount: node.contentSnippet.split(/\s+/).length,
      clusterId: nodeClusterMap.get(node.id),
    })),
    edges: edges.map(edge => ({
      source: edge.source,
      target: edge.target,
      type: edge.type,
      confidence: Number(edge.confidence.toFixed(3)),
      method: edge.method,
      explanation: edge.explanation,
    })),
    clusters: clusterExports,
    orphans: orphans.map(o => o.id),
    knowledgeGaps: gaps.map(gap => ({
      id: gap.id,
      type: gap.type,
      description: gap.description,
      involvedNotes: gap.involvedNotes,
      confidence: gap.confidence,
      suggestedAction: gap.suggestedAction,
    })),
    metadata: {
      topConnectedNodes: topConnected,
      tagDistribution: tagCounts,
      edgeTypeDistribution: edgeTypeCounts,
    },
  };
}

export function exportToJSONString(
  nodes: NoteNode[],
  edges: ConfidenceEdge[],
  clusters: string[][],
  orphans: NoteNode[],
  gaps: KnowledgeGap[]
): string {
  const data = exportToJSON(nodes, edges, clusters, orphans, gaps);
  return JSON.stringify(data, null, 2);
}
