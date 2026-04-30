import type { NoteNode } from '../../core/types';
import type { ConfidenceEdge } from '../../graph/edgeConfidence';
import type { KnowledgeGap } from '../../gap/gapTypes';
import { groupEdgesByType, getAverageConfidenceByType } from '../../graph/edgeConfidence';

export function exportToMarkdown(
  nodes: NoteNode[],
  edges: ConfidenceEdge[],
  clusters: string[][],
  orphans: NoteNode[],
  gaps: KnowledgeGap[]
): string {
  const now = new Date().toLocaleString();
  const groupedEdges = groupEdgesByType(edges);
  const avgConfidence = getAverageConfidenceByType(edges);

  const totalNodes = nodes.length;
  const totalEdges = edges.length;
  const orphanCount = orphans.length;
  const clusterCount = clusters.length;

  const tagCounts: Record<string, number> = {};
  for (const node of nodes) {
    for (const tag of node.tags) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const nodeTitles = new Map(nodes.map(n => [n.id, n.title]));

  const lines: string[] = [
    '# Graph Intelligence Report',
    '',
    `*Generated: ${now}*`,
    '',
    '---',
    '',
    '## Executive Summary',
    '',
    `- **Total Notes**: ${totalNodes}`,
    `- **Total Connections**: ${totalEdges}`,
    `- **Knowledge Clusters**: ${clusterCount}`,
    `- **Orphan Notes**: ${orphanCount}`,
    `- **Knowledge Gaps**: ${gaps.length}`,
    '',
    '---',
    '',
    '## Edge Type Distribution',
    '',
    '| Type | Count | Avg Confidence |',
    '|------|-------|-----------------|',
  ];

  for (const [type, typeEdges] of Object.entries(groupedEdges)) {
    const count = typeEdges.length;
    const avg = avgConfidence[type as keyof typeof avgConfidence];
    const avgStr = count > 0 ? `${(avg * 100).toFixed(1)}%` : 'N/A';
    lines.push(`| ${type} | ${count} | ${avgStr} |`);
  }

  lines.push(
    '',
    '---',
    '',
    '## Knowledge Clusters',
    ''
  );

  clusters.forEach((cluster, idx) => {
    if (cluster.length < 2) return;
    
    const clusterTags: Record<string, number> = {};
    for (const nodeId of cluster) {
      const node = nodes.find(n => n.id === nodeId);
      if (node) {
        for (const tag of node.tags) {
          clusterTags[tag] = (clusterTags[tag] || 0) + 1;
        }
      }
    }
    
    const dominantTags = Object.entries(clusterTags)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag]) => tag);

    lines.push(
      `### Cluster ${idx + 1} (${cluster.length} notes)`,
      '',
      dominantTags.length > 0 ? `**Themes**: ${dominantTags.join(', ')}` : '**Themes**: (none)',
      '',
      '| Note | Links |',
      '|------|-------|'
    );

    for (const nodeId of cluster.slice(0, 20)) {
      const node = nodes.find(n => n.id === nodeId);
      if (node) {
        const outgoingLinks = node.links.length;
        lines.push(`| ${node.title} | ${outgoingLinks} |`);
      }
    }

    if (cluster.length > 20) {
      lines.push(`| ... and ${cluster.length - 20} more | - |`);
    }

    lines.push('');
  });

  lines.push(
    '---',
    '',
    '## Orphan Notes',
    '',
    'These notes have no connections to the rest of your knowledge graph:',
    ''
  );

  if (orphans.length === 0) {
    lines.push('*No orphan notes found! Your vault is well-connected.*');
  } else {
    for (const orphan of orphans) {
      lines.push(`- [[${orphan.title}]]`);
    }
  }

  lines.push(
    '',
    '---',
    '',
    '## Knowledge Gaps',
    '',
    'Detected areas where your knowledge graph could be improved:',
    ''
  );

  if (gaps.length === 0) {
    lines.push('*No significant knowledge gaps detected.*');
  } else {
    for (const gap of gaps) {
      lines.push(
        `### ${gap.description}`,
        '',
        `- **Type**: ${gap.type}`,
        `- **Confidence**: ${(gap.confidence * 100).toFixed(1)}%`,
        `- **Suggestion**: ${gap.suggestedAction.type === 'link' ? 'Create link' : 'Create note'} - ${gap.suggestedAction.details}`,
        ''
      );

      if (gap.involvedNotes.length > 0) {
        lines.push('**Involved notes:**');
        for (const noteId of gap.involvedNotes) {
          const title = nodeTitles.get(noteId) || noteId;
          lines.push(`- [[${title}]]`);
        }
        lines.push('');
      }
    }
  }

  lines.push(
    '',
    '---',
    '',
    '## Tag Analysis',
    ''
  );

  if (topTags.length === 0) {
    lines.push('*No tags found in vault.*');
  } else {
    lines.push('| Tag | Usage Count |', '|-----|-------------|');
    for (const [tag, count] of topTags) {
      lines.push(`| #${tag} | ${count} |`);
    }
  }

  lines.push(
    '',
    '---',
    '',
    '## Recommendations',
    '',
    'Based on the graph analysis:',
    ''
  );

  const recommendations: string[] = [];

  if (orphans.length > 0) {
    recommendations.push(`- **Connect orphan notes**: ${orphans.length} notes have no connections. Consider linking them to related content.`);
  }

  if (clusterCount > 5) {
    recommendations.push(`- **Bridge clusters**: Your vault has ${clusterCount} distinct clusters. Look for connections between them.`);
  }

  if (gaps.length > 0) {
    recommendations.push(`- **Address knowledge gaps**: ${gaps.length} potential improvements identified. Review the gaps section above.`);
  }

  if (groupedEdges.semantic.length === 0 && totalNodes > 10) {
    recommendations.push('- **Run semantic analysis**: No semantic edges detected. Consider analyzing content for hidden connections.');
  }

  if (recommendations.length === 0) {
    lines.push('- Your vault structure looks healthy! Keep building connections as you learn.');
  } else {
    lines.push(...recommendations);
  }

  lines.push(
    '',
    '---',
    '',
    '*Generated by Graph Intelligence for Obsidian*',
    ''
  );

  return lines.join('\n');
}

export function exportToMarkdownSummary(
  nodes: NoteNode[],
  edges: ConfidenceEdge[],
  clusters: string[][]
): string {
  const grouped = groupEdgesByType(edges);
  
  return `# Vault Summary

**${nodes.length}** notes - **${edges.length}** connections - **${clusters.length}** clusters

### Edge Types
- Explicit (wikilinks): ${grouped.explicit.length}
- Semantic (similarity): ${grouped.semantic.length}
- Inferred (multi-hop): ${grouped.inferred.length}
- AI Suggested: ${grouped.ai_generated.length}

_Generated by Graph Intelligence_
`;
}
