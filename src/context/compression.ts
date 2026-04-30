import type { ContextPack, CompressionLevel } from './types';
import { estimateTokens, truncateToTokens } from './types';

export function compressToTokenBudget(
  pack: ContextPack,
  maxTokens: number
): ContextPack {
  const currentTokens = pack.metadata.totalTokens;
  
  if (currentTokens <= maxTokens) {
    return pack;
  }

  const compressed: ContextPack = {
    ...pack,
    clusters: [...pack.clusters],
    keyNodes: [...pack.keyNodes],
    relationships: [...pack.relationships],
    gaps: [...pack.gaps],
  };

  const reductionRatio = maxTokens / currentTokens;

  if (reductionRatio < 0.8) {
    compressed.clusters = compressed.clusters.slice(0, Math.max(3, Math.floor(compressed.clusters.length * reductionRatio)));
  }

  if (reductionRatio < 0.7) {
    compressed.keyNodes = compressed.keyNodes.slice(0, Math.max(10, Math.floor(compressed.keyNodes.length * reductionRatio)));
  }

  if (reductionRatio < 0.6) {
    compressed.relationships = compressed.relationships.slice(0, Math.max(15, Math.floor(compressed.relationships.length * reductionRatio)));
  }

  if (reductionRatio < 0.5) {
    for (const cluster of compressed.clusters) {
      cluster.summary = truncateToTokens(cluster.summary, 50);
      cluster.themes = cluster.themes.slice(0, 3);
      cluster.keyNotes = cluster.keyNotes.slice(0, 3);
    }
  }

  compressed.content = regenerateContent(compressed, pack.metadata.format);
  compressed.metadata.totalTokens = estimateTokens(compressed.content);

  let attempts = 0;
  while (compressed.metadata.totalTokens > maxTokens && attempts < 6) {
    attempts++;

    if (compressed.gaps.length > 0) {
      compressed.gaps = compressed.gaps.slice(0, Math.floor(compressed.gaps.length / 2));
    } else if (compressed.relationships.length > 5) {
      compressed.relationships = compressed.relationships.slice(0, Math.max(5, Math.floor(compressed.relationships.length / 2)));
    } else if (compressed.keyNodes.length > 5) {
      compressed.keyNodes = compressed.keyNodes.slice(0, Math.max(5, Math.floor(compressed.keyNodes.length / 2)));
    } else if (compressed.clusters.length > 2) {
      compressed.clusters = compressed.clusters.slice(0, Math.max(2, Math.floor(compressed.clusters.length / 2)));
    } else {
      break;
    }

    compressed.content = regenerateContent(compressed, pack.metadata.format);
    compressed.metadata.totalTokens = estimateTokens(compressed.content);
  }

  return compressed;
}

function regenerateContent(pack: ContextPack, format: ContextPack['metadata']['format']): string {
  switch (format) {
    case 'json':
      return JSON.stringify({
        overview: pack.overview,
        clusters: pack.clusters,
        keyNodes: pack.keyNodes,
        relationships: pack.relationships,
        gaps: pack.gaps,
      }, null, 1);

    case 'markdown':
    case 'text':

      return generateCompactContent(pack, format);

    default:
      return JSON.stringify(pack);
  }
}

function generateCompactContent(pack: ContextPack, format: 'markdown' | 'text'): string {
  if (format === 'markdown') {
    return [
      `# Vault (${pack.overview.totalNotes} notes, ${pack.overview.totalConnections} links)`,
      '',
      `Clusters: ${pack.clusters.length}`,
      `Orphans: ${pack.overview.orphanCount}`,
      `Gaps: ${pack.gaps.length}`,
      '',
      '## Clusters',
      '',
      pack.clusters.map(c => `- **${c.id}**: ${c.summary}`).join('\n'),
      '',
      '## Key Nodes',
      '',
      pack.keyNodes.slice(0, 10).map(n => `- ${n.title} (${n.type}, ${n.connectionCount} conn)`).join('\n'),
    ].join('\n');
  }

  return [
    `VAULT: ${pack.overview.totalNotes} notes, ${pack.overview.totalConnections} links`,
    '',
    `CLUSTERS (${pack.clusters.length}):`,
    pack.clusters.map(c => `${c.id}: ${c.summary}`).join('\n'),
    '',
    `KEY NODES:`,
    pack.keyNodes.slice(0, 10).map(n => `- ${n.title} (${n.type})`).join('\n'),
  ].join('\n');
}

export function createMinimalContext(
  totalNotes: number,
  totalEdges: number,
  clusterCount: number,
  orphanCount: number,
  gapCount: number
): string {
  return JSON.stringify({
    summary: `Vault: ${totalNotes} notes, ${totalEdges} connections`,
    structure: {
      clusters: clusterCount,
      orphans: orphanCount,
      gaps: gapCount,
    },
  });
}

export function selectRepresentativeNodes<T extends { importance: number; id: string }>(
  nodes: T[],
  targetCount: number
): T[] {

  const sorted = [...nodes].sort((a, b) => b.importance - a.importance);

  return sorted.slice(0, targetCount);
}

export function deduplicateRelationships<T extends { source: string; target: string; strength: number }>(
  relationships: T[]
): T[] {
  const seen = new Map<string, T>();

  for (const rel of relationships) {
    const key = `${rel.source}|${rel.target}`;
    const existing = seen.get(key);
    
    if (!existing || rel.strength > existing.strength) {
      seen.set(key, rel);
    }
  }

  return Array.from(seen.values());
}

export function mergeContextPacks(packs: ContextPack[]): ContextPack | null {
  if (packs.length === 0) return null;
  if (packs.length === 1) return packs[0];

  const merged: ContextPack = {
    metadata: {
      generatedAt: new Date().toISOString(),
      compressionLevel: packs[0].metadata.compressionLevel,
      format: packs[0].metadata.format,
      totalTokens: 0,
      nodeCount: 0,
      edgeCount: 0,
    },
    overview: {
      totalNotes: 0,
      totalConnections: 0,
      clusterCount: 0,
      orphanCount: 0,
      knowledgeGaps: 0,
      coverageEstimate: 'merged',
    },
    clusters: [],
    keyNodes: [],
    relationships: [],
    gaps: [],
    content: '',
  };

  const clusterIds = new Set<string>();
  for (const pack of packs) {
    for (const cluster of pack.clusters) {
      if (!clusterIds.has(cluster.id)) {
        clusterIds.add(cluster.id);
        merged.clusters.push(cluster);
      }
    }
  }

  const nodeMap = new Map<string, typeof merged.keyNodes[0]>();
  for (const pack of packs) {
    for (const node of pack.keyNodes) {
      const existing = nodeMap.get(node.id);
      if (!existing || node.importance > existing.importance) {
        nodeMap.set(node.id, node);
      }
    }
  }
  merged.keyNodes = Array.from(nodeMap.values());

  const allRelationships: typeof merged.relationships = [];
  for (const pack of packs) {
    allRelationships.push(...pack.relationships);
  }
  merged.relationships = deduplicateRelationships(allRelationships);

  const gapDescriptions = new Set<string>();
  for (const pack of packs) {
    for (const gap of pack.gaps) {
      if (!gapDescriptions.has(gap.description)) {
        gapDescriptions.add(gap.description);
        merged.gaps.push(gap);
      }
    }
  }

  merged.overview.totalNotes = Math.max(...packs.map(p => p.overview.totalNotes));
  merged.overview.totalConnections = Math.max(...packs.map(p => p.overview.totalConnections));
  merged.overview.clusterCount = merged.clusters.length;
  merged.overview.orphanCount = Math.max(...packs.map(p => p.overview.orphanCount));
  merged.overview.knowledgeGaps = merged.gaps.length;

  merged.metadata.nodeCount = merged.overview.totalNotes;
  merged.metadata.edgeCount = merged.overview.totalConnections;

  merged.content = JSON.stringify({
    overview: merged.overview,
    clusters: merged.clusters,
    keyNodes: merged.keyNodes,
    relationships: merged.relationships,
    gaps: merged.gaps,
  }, null, 2);

  merged.metadata.totalTokens = estimateTokens(merged.content);

  return merged;
}
