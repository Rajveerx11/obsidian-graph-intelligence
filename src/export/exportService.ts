import type { App } from 'obsidian';
import type { NoteNode } from '../core/types';
import type { ConfidenceEdge } from '../graph/edgeConfidence';
import type { KnowledgeGap } from '../gap/gapTypes';
import { exportToJSONString } from './exporters/jsonExporter';
import { exportToGraphML } from './exporters/graphMLExporter';
import { exportToMarkdown, exportToMarkdownSummary } from './exporters/markdownExporter';
import { writeFile } from '../persistence';

export type ExportFormat = 'json' | 'graphml' | 'markdown' | 'markdown-summary';

export interface ExportOptions {
  format: ExportFormat;
  includeOrphans?: boolean;
  includeGaps?: boolean;
  filename?: string;
}

export interface ExportResult {
  success: boolean;
  data?: string;
  filename: string;
  error?: string;
}

export async function exportGraph(
  app: App,
  nodes: NoteNode[],
  edges: ConfidenceEdge[],
  clusters: string[][],
  orphans: NoteNode[],
  gaps: KnowledgeGap[],
  options: ExportOptions
): Promise<ExportResult> {
  try {
    let content: string;
    let extension: string;

    switch (options.format) {
      case 'json':
        content = exportToJSONString(nodes, edges, clusters, orphans, gaps);
        extension = 'json';
        break;

      case 'graphml':
        content = exportToGraphML(nodes, edges);
        extension = 'graphml';
        break;

      case 'markdown':
        content = exportToMarkdown(nodes, edges, clusters, orphans, gaps);
        extension = 'md';
        break;

      case 'markdown-summary':
        content = exportToMarkdownSummary(nodes, edges, clusters);
        extension = 'md';
        break;

      default:
        return {
          success: false,
          filename: '',
          error: `Unknown export format: ${options.format}`,
        };
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = options.filename || `graph-intelligence-${timestamp}.${extension}`;

    const filePath = `exports/${filename}`;
    await writeFile(app, filePath, content);

    return {
      success: true,
      data: content,
      filename: filePath,
    };
  } catch (err) {
    console.error('[ogi] Export failed:', err);
    return {
      success: false,
      filename: '',
      error: err instanceof Error ? err.message : 'Unknown export error',
    };
  }
}

export function exportToClipboard(
  nodes: NoteNode[],
  edges: ConfidenceEdge[],
  clusters: string[][],
  orphans: NoteNode[],
  gaps: KnowledgeGap[],
  format: Exclude<ExportFormat, 'graphml'> = 'json'
): string {
  switch (format) {
    case 'json':
      return exportToJSONString(nodes, edges, clusters, orphans, gaps);
    case 'markdown':
      return exportToMarkdown(nodes, edges, clusters, orphans, gaps);
    case 'markdown-summary':
      return exportToMarkdownSummary(nodes, edges, clusters);
    default:
      return exportToJSONString(nodes, edges, clusters, orphans, gaps);
  }
}

export function getExportFormats(): Array<{ id: ExportFormat; name: string; description: string }> {
  return [
    {
      id: 'json',
      name: 'JSON',
      description: 'Complete structured data with nodes, edges, clusters, and metadata',
    },
    {
      id: 'graphml',
      name: 'GraphML',
      description: 'XML format for Gephi, yEd, Cytoscape, and other graph tools',
    },
    {
      id: 'markdown',
      name: 'Markdown Report',
      description: 'Comprehensive human-readable analysis report',
    },
    {
      id: 'markdown-summary',
      name: 'Markdown Summary',
      description: 'Quick overview in markdown format',
    },
  ];
}
