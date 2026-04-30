import type { NoteNode } from '../core/types';
import type { ConfidenceEdge } from '../graph/edgeConfidence';
import type { KnowledgeGap } from '../gap/gapTypes';
import type {
  ContextPack,
  ContextCluster,
  ContextNode,
  ContextRelationship,
  ContextGap,
  ContextCompressionConfig,
  CompressionLevel,
} from './types';
import { estimateTokens, truncateToTokens, DEFAULT_COMPRESSION_CONFIG, TOKEN_BUDGETS } from './types';

function summarizeCluster(
  clusterId: string,
  nodeIds: string[],
  nodes: NoteNode[],
  edges: ConfidenceEdge[],
  level: CompressionLevel
): ContextCluster {
  const clusterNodes = nodeIds
    .map(id => nodes.find(n => n.id === id))
    .filter((n): n is NoteNode => n !== undefined);

  const tagCounts: Record<string, number> = {};
  for (const node of clusterNodes) {
    for (const tag of node.tags) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }

  const themes = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, level === 'short' ? 3 : 5)
    .map(([tag]) => tag);

  const connectionCounts = new Map<string, number>();
  for (const edge of edges) {
    if (nodeIds.includes(edge.source)) {
      connectionCounts.set(edge.source, (connectionCounts.get(edge.source) || 0) + 1);
    }
    if (nodeIds.includes(edge.target)) {
      connectionCounts.set(edge.target, (connectionCounts.get(edge.target) || 0) + 1);
    }
  }

  const keyNotes = clusterNodes
    .map(n => ({
      id: n.id,
      title: n.title,
      connections: connectionCounts.get(n.id) || 0,
    }))
    .sort((a, b) => b.connections - a.connections)
    .slice(0, level === 'short' ? 3 : 5)
    .map(({ id, title }) => ({ id, title }));

  const externalConnections = edges.filter(
    e => (nodeIds.includes(e.source) && !nodeIds.includes(e.target)) ||
         (nodeIds.includes(e.target) && !nodeIds.includes(e.source))
  ).length;

  let summary: string;
  if (level === 'short') {
    summary = `Cluster of ${clusterNodes.length} notes${themes.length > 0 ? ` about ${themes.join(', ')}` : ''}`;
  } else if (level === 'medium') {
    const topTheme = themes[0] ? ` themed around ${themes[0]}` : '';
    summary = `A cluster of ${clusterNodes.length} related notes${topTheme}. ${keyNotes.length} key notes with ${externalConnections} external connections.`;
  } else {
    const themeList = themes.length > 0 ? ` Covers: ${themes.join(', ')}.` : '';
    summary = `Detailed cluster containing ${clusterNodes.length} interconnected notes.${themeList} Contains ${keyNotes.length} hub notes and ${externalConnections} cross-cluster links.`;
  }

  return {
    id: clusterId,
    size: clusterNodes.length,
    summary: truncateToTokens(summary, level === 'short' ? 50 : level === 'medium' ? 100 : 200),
    themes,
    keyNotes,
    connectionsToOtherClusters: externalConnections,
  };
}

function identifyKeyNodes(
  nodes: NoteNode[],
  edges: ConfidenceEdge[],
  maxNodes: number,
  level: CompressionLevel
): ContextNode[] {
  const connectionCounts = new Map<string, number>();

  for (const edge of edges) {
    connectionCounts.set(edge.source, (connectionCounts.get(edge.source) || 0) + 1);
    connectionCounts.set(edge.target, (connectionCounts.get(edge.target) || 0) + 1);
  }

  const avgConnections = edges.length * 2 / Math.max(nodes.length, 1);
  const importanceDenominator = Math.max(avgConnections * 3, 1);

  const keyNodes: ContextNode[] = [];

  for (const node of nodes) {
    const connections = connectionCounts.get(node.id) || 0;

    let type: ContextNode['type'];
    if (connections === 0) {
      type = 'leaf';
    } else if (connections > avgConnections * 2) {
      type = 'hub';
    } else if (connections < avgConnections * 0.5) {
      type = 'leaf';
    } else {
      type = 'bridge';
    }

    const importance = Math.min(connections / importanceDenominator, 1);

    keyNodes.push({
      id: node.id,
      title: node.title,
      type,
      importance: Number(importance.toFixed(3)),
      connectionCount: connections,
      tags: level === 'short' ? node.tags.slice(0, 3) : node.tags,
      summary: level === 'detailed' ? truncateToTokens(node.contentSnippet, 100) : undefined,
    });
  }

  return keyNodes
    .sort((a, b) => b.importance - a.importance)
    .slice(0, maxNodes);
}

function summarizeRelationships(
  edges: ConfidenceEdge[],
  maxRelationships: number,
  level: CompressionLevel
): ContextRelationship[] {
  const sortedEdges = [...edges]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, maxRelationships);

  return sortedEdges.map(edge => ({
    source: edge.source,
    target: edge.target,
    type: edge.type,
    strength: Number(edge.confidence.toFixed(3)),
    explanation: level === 'detailed' ? edge.explanation : undefined,
  }));
}

function summarizeGaps(
  gaps: KnowledgeGap[],
  maxGaps: number,
  level: CompressionLevel
): ContextGap[] {
  return gaps.slice(0, maxGaps).map(gap => ({
    description: gap.description,
    severity: gap.confidence > 0.8 ? 'high' : gap.confidence > 0.5 ? 'medium' : 'low',
    involvedClusters: gap.involvedNotes.slice(0, 2),
  }));
}

export function generateContextPack(
  nodes: NoteNode[],
  edges: ConfidenceEdge[],
  clusters: string[][],
  orphans: NoteNode[],
  gaps: KnowledgeGap[],
  config: ContextCompressionConfig = DEFAULT_COMPRESSION_CONFIG
): ContextPack {
  const level = config.level;
  const maxTokens = config.maxTokens > 0 ? config.maxTokens : TOKEN_BUDGETS[level];

  const clusterSummaries: ContextCluster[] = [];
  let tokenBudget = maxTokens * 0.4;

  for (let i = 0; i < clusters.length && i < config.maxClusters; i++) {
    const cluster = clusters[i];
    if (cluster.length < 2) continue;

    const summary = summarizeCluster(
      `cluster-${i + 1}`,
      cluster,
      nodes,
      edges,
      level
    );

    const clusterTokens = estimateTokens(JSON.stringify(summary));
    if (clusterTokens > tokenBudget) break;

    clusterSummaries.push(summary);
    tokenBudget -= clusterTokens;
  }

  const keyNodes = identifyKeyNodes(
    nodes,
    edges,
    config.maxKeyNodes,
    level
  );

  const relationships = summarizeRelationships(
    edges,
    config.maxRelationships,
    level
  );

  const gapSummaries = summarizeGaps(gaps, 10, level);

  const pack: ContextPack = {
    metadata: {
      generatedAt: new Date().toISOString(),
      compressionLevel: level,
      format: config.format,
      totalTokens: 0,
      nodeCount: nodes.length,
      edgeCount: edges.length,
    },
    overview: {
      totalNotes: nodes.length,
      totalConnections: edges.length,
      clusterCount: clusters.filter(c => c.length > 1).length,
      orphanCount: orphans.length,
      knowledgeGaps: gaps.length,
      coverageEstimate: `${(clusterSummaries.length / Math.max(clusters.filter(c => c.length > 1).length, 1) * 100).toFixed(0)}%`,
    },
    clusters: clusterSummaries,
    keyNodes,
    relationships,
    gaps: gapSummaries,
    content: '',
  };

  pack.content = generateContentString(pack, config.format);
  pack.metadata.totalTokens = estimateTokens(pack.content);

  return pack;
}

function generateContentString(pack: ContextPack, format: ContextPack['metadata']['format']): string {
  switch (format) {
    case 'json':
      return JSON.stringify({
        overview: pack.overview,
        clusters: pack.clusters,
        keyNodes: pack.keyNodes,
        relationships: pack.relationships,
        gaps: pack.gaps,
      }, null, 2);

    case 'markdown':
      return generateMarkdownContent(pack);

    case 'text':
      return generateTextContent(pack);

    default:
      return JSON.stringify(pack);
  }
}

function generateMarkdownContent(pack: ContextPack): string {
  const lines: string[] = [
    '# Vault Context Summary',
    '',
    `*Generated: ${pack.metadata.generatedAt}*`,
    `*Compression: ${pack.metadata.compressionLevel}*`,
    '',
    '## Overview',
    '',
    `- **Total Notes**: ${pack.overview.totalNotes}`,
    `- **Connections**: ${pack.overview.totalConnections}`,
    `- **Clusters**: ${pack.overview.clusterCount}`,
    `- **Orphans**: ${pack.overview.orphanCount}`,
    `- **Gaps**: ${pack.overview.knowledgeGaps}`,
    '',
    '## Key Knowledge Clusters',
    '',
  ];

  for (const cluster of pack.clusters) {
    lines.push(
      `### ${cluster.id} (${cluster.size} notes)`,
      '',
      cluster.summary,
      '',
      cluster.themes.length > 0 ? `**Themes**: ${cluster.themes.join(', ')}` : '',
      '',
      `**Key Notes**: ${cluster.keyNotes.map(n => n.title).join(', ')}`,
      '',
    );
  }

  lines.push(
    '## Key Nodes',
    '',
    '| Title | Type | Connections | Importance |',
    '|-------|------|-------------|------------|'
  );

  for (const node of pack.keyNodes) {
    lines.push(`| ${node.title} | ${node.type} | ${node.connectionCount} | ${(node.importance * 100).toFixed(0)}% |`);
  }

  lines.push(
    '',
    '## Knowledge Gaps',
    ''
  );

  for (const gap of pack.gaps) {
    lines.push(`- **${gap.severity.toUpperCase()}**: ${gap.description}`);
  }

  return lines.join('\n');
}

function generateTextContent(pack: ContextPack): string {
  const lines: string[] = [
    'VAULT CONTEXT SUMMARY',
    '',
    `This vault contains ${pack.overview.totalNotes} notes with ${pack.overview.totalConnections} connections.`,
    `Organized into ${pack.overview.clusterCount} knowledge clusters.`,
    `${pack.overview.orphanCount} notes are disconnected (orphans).`,
    `${pack.overview.knowledgeGaps} potential improvements identified.`,
    '',
    'KNOWLEDGE CLUSTERS:',
    '',
  ];

  for (const cluster of pack.clusters) {
    lines.push(
      `${cluster.id}: ${cluster.summary}`,
      `  Size: ${cluster.size} notes`,
      `  Themes: ${cluster.themes.join(', ') || 'none'}`,
      `  Key notes: ${cluster.keyNotes.map(n => n.title).join(', ')}`,
      ''
    );
  }

  lines.push(
    'KEY NODES (HUBS & BRIDGES):',
    ''
  );

  for (const node of pack.keyNodes.slice(0, 10)) {
    lines.push(`- ${node.title} (${node.type}, ${node.connectionCount} connections)`);
  }

  lines.push(
    '',
    'TOP RELATIONSHIPS:',
    ''
  );

  for (const rel of pack.relationships.slice(0, 10)) {
    lines.push(`- ${rel.source} -> ${rel.target} (${rel.type}, strength: ${(rel.strength * 100).toFixed(0)}%)`);
  }

  return lines.join('\n');
}
