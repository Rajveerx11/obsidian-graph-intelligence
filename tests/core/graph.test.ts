import { describe, expect, it } from 'vitest';
import { buildGraph, getClusters, getOrphans, getTotalLinks } from '../../src/core';
import type { NoteNode } from '../../src/core';

function note(id: string, links: string[] = []): NoteNode {
  const title = id.replace(/\.md$/i, '').split('/').pop() ?? id;
  return {
    id,
    title,
    links,
    tags: [],
    mtime: 0,
    contentSnippet: '',
  };
}

describe('graph construction', () => {
  it('resolves known note titles and skips missing targets and self-links', () => {
    const graph = buildGraph([
      note('Alpha.md', ['Beta', 'Missing', 'Alpha']),
      note('folder/Beta.md'),
      note('Gamma.md', ['Beta']),
    ]);

    expect(graph.edges).toEqual([
      { source: 'Alpha.md', target: 'folder/Beta.md' },
      { source: 'Gamma.md', target: 'folder/Beta.md' },
    ]);
    expect(getTotalLinks(graph)).toBe(2);
  });
});

describe('graph queries', () => {
  it('treats nodes with either incoming or outgoing edges as connected', () => {
    const graph = buildGraph([
      note('Alpha.md', ['Beta']),
      note('Beta.md'),
      note('Orphan.md'),
    ]);

    expect(getOrphans(graph).map((node) => node.id)).toEqual(['Orphan.md']);
  });

  it('finds connected components without depending on edge direction', () => {
    const graph = buildGraph([
      note('Alpha.md', ['Beta']),
      note('Beta.md'),
      note('Gamma.md', ['Delta']),
      note('Delta.md'),
      note('Orphan.md'),
    ]);

    expect(getClusters(graph)).toEqual([
      ['Alpha.md', 'Beta.md'],
      ['Gamma.md', 'Delta.md'],
      ['Orphan.md'],
    ]);
  });
});
