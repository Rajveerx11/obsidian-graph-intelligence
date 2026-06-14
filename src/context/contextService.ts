import type { App } from 'obsidian';
import type { NoteNode } from '../core/types';
import type { ConfidenceEdge } from '../graph/edgeConfidence';
import type { KnowledgeGap } from '../gap/gapTypes';
import type { 
  ContextPack, 
  ContextCompressionConfig, 
  CompressionLevel,
  ContextFormat 
} from './types';
import { generateContextPack } from './summarizer';
import { compressToTokenBudget, createMinimalContext } from './compression';
import { DEFAULT_COMPRESSION_CONFIG, TOKEN_BUDGETS } from './types';
import { writeFile } from '../persistence';

export interface ContextServiceOptions {
  config?: ContextCompressionConfig;
  forceRefresh?: boolean;
}

export interface GenerateContextResult {
  success: boolean;
  pack?: ContextPack;
  error?: string;
  tokensUsed: number;
  tokensRemaining: number;
}

export class ContextService {
  private app: App;
  private config: ContextCompressionConfig;
  private cachedPack: ContextPack | null = null;
  private cacheTimestamp: number = 0;

  constructor(app: App, config?: ContextCompressionConfig) {
    this.app = app;
    this.config = config || DEFAULT_COMPRESSION_CONFIG;
  }

  updateConfig(config: ContextCompressionConfig): void {
    this.config = config;
    this.cachedPack = null;
  }

  generateContext(
    nodes: NoteNode[],
    edges: ConfidenceEdge[],
    clusters: string[][],
    orphans: NoteNode[],
    gaps: KnowledgeGap[]
  ): ContextPack {
    return generateContextPack(nodes, edges, clusters, orphans, gaps, this.config);
  }

  generateConstrainedContext(
    nodes: NoteNode[],
    edges: ConfidenceEdge[],
    clusters: string[][],
    orphans: NoteNode[],
    gaps: KnowledgeGap[],
    maxTokens?: number
  ): GenerateContextResult {
    try {
      const targetTokens = maxTokens || this.config.maxTokens || TOKEN_BUDGETS[this.config.level];

      let pack = this.generateContext(nodes, edges, clusters, orphans, gaps);

      if (pack.metadata.totalTokens > targetTokens) {
        pack = compressToTokenBudget(pack, targetTokens);
      }

      this.cachedPack = pack;
      this.cacheTimestamp = Date.now();

      return {
        success: true,
        pack,
        tokensUsed: pack.metadata.totalTokens,
        tokensRemaining: targetTokens - pack.metadata.totalTokens,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to generate context',
        tokensUsed: 0,
        tokensRemaining: maxTokens || this.config.maxTokens || TOKEN_BUDGETS[this.config.level],
      };
    }
  }

  getCachedContext(maxAgeMs: number = 5 * 60 * 1000): ContextPack | null {
    if (!this.cachedPack) return null;
    
    const age = Date.now() - this.cacheTimestamp;
    if (age > maxAgeMs) {
      this.cachedPack = null;
      return null;
    }

    return this.cachedPack;
  }

  clearCache(): void {
    this.cachedPack = null;
    this.cacheTimestamp = 0;
  }

  async exportContext(pack: ContextPack, filename?: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const defaultName = `context-pack-${timestamp}.${pack.metadata.format === 'json' ? 'json' : 'md'}`;
    const filePath = `context-packs/${filename || defaultName}`;

    try {
      await writeFile(this.app, filePath, pack.content);
      return filePath;
    } catch (err) {
      console.error('[ogi] Failed to export context:', err);
      throw err;
    }
  }

  async copyToClipboard(pack: ContextPack): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(pack.content);
      return true;
    } catch (err) {
      console.error('[ogi] Failed to copy context to clipboard:', err);
      return false;
    }
  }

  createMinimalContext(
    totalNotes: number,
    totalEdges: number,
    clusterCount: number,
    orphanCount: number,
    gapCount: number
  ): string {
    return createMinimalContext(totalNotes, totalEdges, clusterCount, orphanCount, gapCount);
  }

  static getCompressionLevels(): Array<{ level: CompressionLevel; name: string; description: string; tokens: number }> {
    return [
      {
        level: 'short',
        name: 'Short',
        description: 'Ultra-compact (~1000 tokens). Best for quick LLM queries.',
        tokens: TOKEN_BUDGETS.short,
      },
      {
        level: 'medium',
        name: 'Medium',
        description: 'Balanced summary (~3000 tokens). Good for most use cases.',
        tokens: TOKEN_BUDGETS.medium,
      },
      {
        level: 'detailed',
        name: 'Detailed',
        description: 'Comprehensive (~6000 tokens). Best for deep analysis.',
        tokens: TOKEN_BUDGETS.detailed,
      },
    ];
  }

  static getFormats(): Array<{ format: ContextFormat; name: string; description: string }> {
    return [
      {
        format: 'json',
        name: 'JSON',
        description: 'Structured data format for programmatic use',
      },
      {
        format: 'markdown',
        name: 'Markdown',
        description: 'Human-readable report format',
      },
      {
        format: 'text',
        name: 'Plain Text',
        description: 'Simple text format',
      },
    ];
  }
}

export function generateQuickContext(
  nodes: NoteNode[],
  edges: ConfidenceEdge[],
  clusters: string[][],
  orphans: NoteNode[],
  gaps: KnowledgeGap[],
  level: CompressionLevel = 'medium'
): ContextPack {
  const config: ContextCompressionConfig = {
    ...DEFAULT_COMPRESSION_CONFIG,
    level,
  };
  return generateContextPack(nodes, edges, clusters, orphans, gaps, config);
}
