export type EdgeType = 'explicit' | 'semantic' | 'inferred' | 'ai_generated';

export type ConfidenceMethod = 
  | 'wikilink_direct' 
  | 'cosine_similarity' 
  | 'multi_hop_path' 
  | 'llm_suggestion' 
  | 'hybrid';

export interface ConfidenceEdge {
  source: string;
  target: string;
  type: EdgeType;
  confidence: number;
  method: ConfidenceMethod;
  timestamp: number;
  explanation?: string;
  metadata: Record<string, unknown>;
}

export interface ConfidenceConfig {
  minConfidence: number;
  explicitWeight: number;
  semanticWeight: number;
  semanticThreshold: number;
  maxHopDistance: number;
  llmMinConfidence: number;
}

export const DEFAULT_CONFIDENCE_CONFIG: ConfidenceConfig = {
  minConfidence: 0.3,
  explicitWeight: 1.0,
  semanticWeight: 0.8,
  semanticThreshold: 0.75,
  maxHopDistance: 3,
  llmMinConfidence: 0.6,
};

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'uncertain';

export function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 0.8) return 'high';
  if (score >= 0.6) return 'medium';
  if (score >= 0.4) return 'low';
  return 'uncertain';
}

export function createExplicitEdge(
  source: string,
  target: string,
  config: ConfidenceConfig = DEFAULT_CONFIDENCE_CONFIG
): ConfidenceEdge {
  return {
    source,
    target,
    type: 'explicit',
    confidence: config.explicitWeight,
    method: 'wikilink_direct',
    timestamp: Date.now(),
    explanation: `Direct wikilink from "${source}" to "${target}"`,
    metadata: {
      linkType: 'wikilink',
    },
  };
}

export function createSemanticEdge(
  source: string,
  target: string,
  similarityScore: number,
  config: ConfidenceConfig = DEFAULT_CONFIDENCE_CONFIG
): ConfidenceEdge | null {
  if (similarityScore < config.semanticThreshold) {
    return null;
  }

  const confidence = similarityScore * config.semanticWeight;

  if (confidence < config.minConfidence) {
    return null;
  }

  return {
    source,
    target,
    type: 'semantic',
    confidence,
    method: 'cosine_similarity',
    timestamp: Date.now(),
    explanation: `Semantic similarity: ${(similarityScore * 100).toFixed(1)}%`,
    metadata: {
      similarityScore,
      rawScore: similarityScore,
    },
  };
}

export function createInferredEdge(
  source: string,
  target: string,
  pathLength: number,
  pathNodes: string[],
  config: ConfidenceConfig = DEFAULT_CONFIDENCE_CONFIG
): ConfidenceEdge | null {
  if (pathLength < 1 || pathLength > config.maxHopDistance) {
    return null;
  }

  const decayFactor = Math.pow(0.7, pathLength - 1);
  const confidence = decayFactor * 0.6;

  if (confidence < config.minConfidence) {
    return null;
  }

  return {
    source,
    target,
    type: 'inferred',
    confidence,
    method: 'multi_hop_path',
    timestamp: Date.now(),
    explanation: `Inferred via ${pathLength}-hop path through: ${pathNodes.slice(1, -1).join(' -> ')}`,
    metadata: {
      pathLength,
      pathNodes,
      decayFactor,
    },
  };
}

export function createAIGeneratedEdge(
  source: string,
  target: string,
  llmConfidence: number,
  llmReasoning?: string,
  config: ConfidenceConfig = DEFAULT_CONFIDENCE_CONFIG
): ConfidenceEdge | null {
  if (llmConfidence < config.llmMinConfidence) {
    return null;
  }

  const confidence = llmConfidence * 0.85;

  if (confidence < config.minConfidence) {
    return null;
  }

  return {
    source,
    target,
    type: 'ai_generated',
    confidence,
    method: 'llm_suggestion',
    timestamp: Date.now(),
    explanation: llmReasoning || 'Suggested by AI analysis',
    metadata: {
      llmConfidence,
      hasReasoning: !!llmReasoning,
    },
  };
}

export function mergeEdges(edges: ConfidenceEdge[]): ConfidenceEdge[] {
  const edgeMap = new Map<string, ConfidenceEdge>();

  for (const edge of edges) {
    const key = `${edge.source}|${edge.target}`;
    const existing = edgeMap.get(key);

    if (!existing || edge.confidence > existing.confidence) {
      edgeMap.set(key, edge);
    }
  }

  return Array.from(edgeMap.values());
}

export function filterByConfidence(
  edges: ConfidenceEdge[],
  minConfidence: number
): ConfidenceEdge[] {
  return edges.filter(e => e.confidence >= minConfidence);
}

export function groupEdgesByType(edges: ConfidenceEdge[]): Record<EdgeType, ConfidenceEdge[]> {
  const grouped: Record<EdgeType, ConfidenceEdge[]> = {
    explicit: [],
    semantic: [],
    inferred: [],
    ai_generated: [],
  };

  for (const edge of edges) {
    grouped[edge.type].push(edge);
  }

  return grouped;
}

export function getAverageConfidenceByType(
  edges: ConfidenceEdge[]
): Record<EdgeType, number> {
  const grouped = groupEdgesByType(edges);
  const averages: Record<EdgeType, number> = {
    explicit: 0,
    semantic: 0,
    inferred: 0,
    ai_generated: 0,
  };

  for (const [type, typeEdges] of Object.entries(grouped) as [EdgeType, ConfidenceEdge[]][]) {
    if (typeEdges.length > 0) {
      const sum = typeEdges.reduce((acc, e) => acc + e.confidence, 0);
      averages[type] = sum / typeEdges.length;
    }
  }

  return averages;
}

export function getConfidenceColorClass(confidence: number): string {
  const level = getConfidenceLevel(confidence);
  const classes: Record<ConfidenceLevel, string> = {
    high: 'ogi-confidence-high',
    medium: 'ogi-confidence-medium',
    low: 'ogi-confidence-low',
    uncertain: 'ogi-confidence-uncertain',
  };
  return classes[level];
}

export function getEdgeTypeIcon(type: EdgeType): string {
  const icons: Record<EdgeType, string> = {
    explicit: 'link',
    semantic: 'brain',
    inferred: 'git-branch',
    ai_generated: 'sparkles',
  };
  return icons[type];
}

export function serializeEdges(edges: ConfidenceEdge[]): Array<{
  source: string;
  target: string;
  type: EdgeType;
  confidence: number;
  level: ConfidenceLevel;
  method: ConfidenceMethod;
  explanation?: string;
}> {
  return edges.map(e => ({
    source: e.source,
    target: e.target,
    type: e.type,
    confidence: Number(e.confidence.toFixed(3)),
    level: getConfidenceLevel(e.confidence),
    method: e.method,
    explanation: e.explanation,
  }));
}
