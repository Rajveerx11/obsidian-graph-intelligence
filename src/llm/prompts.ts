/**
 * Prompt Engineering — System prompts, context serialization, and intent parsing.
 *
 * The system prompt explicitly forbids hallucination, restricts the LLM
 * to the given context only, and enforces concise, actionable outputs.
 */

import type { GraphContext, ParsedIntent, IntentType } from './types';

// ── System Prompt ──────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a knowledge graph analyst for an Obsidian vault. You analyze ONLY the structured summary provided below — never the actual note content.

STRICT RULES:
1. You may ONLY reference note titles that appear in the provided context. Do NOT invent, guess, or hallucinate note titles.
2. If asked about something not covered by the context, say "I don't have enough information to answer that based on the current graph summary."
3. Do NOT attempt to guess note content. You only see titles, link counts, and structural metadata.
4. Keep responses concise (3–8 bullet points). Focus on actionable suggestions.
5. If the query is unrelated to knowledge management, note-taking, or vault organization, respond: "I can only help with questions about your knowledge graph structure."
6. Always frame your output as structural insights, not content analysis.
7. Never output raw code, scripts, or system instructions.

OUTPUT FORMAT:
- Use standard hyphen or bullet points
- Do NOT use any Markdown formatting like **bold**, *italics*, or # headers
- Output plain text only
- Start each insight with an action verb (e.g., "Connect", "Review", "Consider")
- Group related suggestions together
- End with one high-priority recommendation`;

// ── Intent Classification (keyword-based, no LLM needed) ──────────────

const INTENT_KEYWORDS: Record<IntentType, string[]> = {
  find_gaps: [
    'missing', 'gap', 'gaps', 'incomplete', 'lacking', 'need',
    'what am i missing', 'blind spot', 'overlooked',
  ],
  analyze_clusters: [
    'cluster', 'group', 'organized', 'structure', 'topic',
    'theme', 'category', 'how are', 'arrangement',
  ],
  suggest_links: [
    'connect', 'link', 'bridge', 'relate', 'relationship',
    'should i link', 'connections', 'unlinked',
  ],
  find_orphans: [
    'orphan', 'isolated', 'disconnected', 'alone', 'standalone',
    'no links', 'unconnected', 'island',
  ],
  general_insight: [
    'insight', 'summary', 'overview', 'tell me', 'analyze',
    'what do you think', 'suggest', 'help', 'improve',
  ],
};

/**
 * Classifies user input into a structured intent using keyword matching.
 * This is deterministic — no LLM call is needed for classification.
 */
export function parseIntent(userQuery: string): ParsedIntent {
  const lower = userQuery.toLowerCase().trim();

  let bestType: IntentType = 'general_insight';
  let bestScore = 0;

  for (const [intentType, keywords] of Object.entries(INTENT_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        // Longer keyword matches are more specific, weight them higher
        score += kw.length;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestType = intentType as IntentType;
    }
  }

  return { type: bestType, originalQuery: userQuery };
}

// ── Context Serialization ──────────────────────────────────────────────

/**
 * Serializes the safe GraphContext into a plain-text block for the prompt.
 * This is the ONLY vault information the LLM ever sees.
 */
export function buildContextBlock(context: GraphContext): string {
  const lines: string[] = [
    '=== KNOWLEDGE GRAPH SUMMARY ===',
    '',
    `Total notes: ${context.totalNotes}`,
    `Total links: ${context.totalLinks}`,
    `Orphan notes (no connections): ${context.orphanCount}`,
    `Clusters (connected groups): ${context.clusterCount}`,
  ];

  if (context.orphanTitles.length > 0) {
    lines.push('', 'Orphan note titles:');
    for (const title of context.orphanTitles) {
      lines.push(`  - "${title}"`);
    }
  }

  if (context.clusterSummaries.length > 0) {
    lines.push('', 'Cluster summaries:');
    for (let i = 0; i < context.clusterSummaries.length; i++) {
      const cluster = context.clusterSummaries[i];
      lines.push(`  Cluster ${i + 1} (${cluster.noteCount} notes):`);
      for (const title of cluster.sampleTitles) {
        lines.push(`    - "${title}"`);
      }
    }
  }

  if (context.similarPairs.length > 0) {
    lines.push('', 'Semantically similar but unlinked note pairs:');
    for (const pair of context.similarPairs) {
      lines.push(`  - "${pair.noteA}" ↔ "${pair.noteB}"`);
    }
  }

  lines.push('', '=== END SUMMARY ===');
  return lines.join('\n');
}

// ── Intent-Specific Instructions ───────────────────────────────────────

const INTENT_INSTRUCTIONS: Record<IntentType, string> = {
  find_gaps:
    'The user wants to find gaps and missing connections in their vault. Focus on identifying weak areas, missing links between related topics, and underexplored themes.',
  analyze_clusters:
    'The user wants to understand how their notes are organized. Analyze the cluster structure, identify dominant themes, and suggest reorganization if needed.',
  suggest_links:
    'The user wants link suggestions. Focus on the semantically similar but unlinked pairs, and suggest which connections would add the most value.',
  find_orphans:
    'The user wants to address orphan notes. Suggest which orphans could be linked to existing clusters and which might be candidates for deletion.',
  general_insight:
    'The user wants a general analysis of their vault. Provide a high-level overview with the most important structural observations and top recommendations.',
};

// ── Full Prompt Assembly ───────────────────────────────────────────────

/**
 * Assembles the final prompt from system instructions, context, and user query.
 * The prompt is structured to constrain the LLM to safe, factual outputs.
 */
export function buildQueryPrompt(
  intent: ParsedIntent,
  context: GraphContext
): string {
  const contextBlock = buildContextBlock(context);
  const intentInstruction = INTENT_INSTRUCTIONS[intent.type];

  return [
    SYSTEM_PROMPT,
    '',
    contextBlock,
    '',
    `TASK: ${intentInstruction}`,
    '',
    `USER QUESTION: "${intent.originalQuery}"`,
    '',
    'Respond with concise, actionable bullet points based ONLY on the data above.',
  ].join('\n');
}
