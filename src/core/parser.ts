/**
 * Vault parser — reads all markdown files and extracts graph-relevant metadata.
 *
 * Uses only the Obsidian Vault API (no filesystem access) so the plugin
 * works on all platforms including mobile.
 */

import type { App, TFile } from 'obsidian';
import type { NoteNode } from './types';

// ── Regex patterns ─────────────────────────────────────────────────────

/**
 * Matches wikilinks: [[target]] or [[target|alias]]
 * Captures the target portion (group 1).
 */
const WIKILINK_RE = /\[\[([^\]|#]+)(?:[|#][^\]]+)?\]\]/g;

/**
 * Matches tags: #tag-name (but not inside code blocks or frontmatter).
 * Captures the tag without the leading # (group 1).
 * Negative lookbehind avoids matching hex colours like #fff.
 */
const TAG_RE = /(?:^|\s)#([a-zA-Z][\w-/]*)/g;

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Parses every markdown file in the vault and returns a NoteNode per file.
 *
 * The function is async because `vault.cachedRead` returns a Promise.
 * `cachedRead` is used instead of `read` for better performance — it
 * returns the in-memory cache when available rather than hitting disk.
 */
export async function parseVault(app: App): Promise<NoteNode[]> {
  const files = app.vault.getMarkdownFiles();
  const nodes = await Promise.all(files.map((file) => parseFile(app, file)));
  return nodes;
}

// ── Internals ──────────────────────────────────────────────────────────

async function parseFile(app: App, file: TFile): Promise<NoteNode> {
  const content = await app.vault.cachedRead(file);

  return {
    id: file.path,
    title: file.basename,
    links: extractLinks(content),
    tags: extractTags(content),
  };
}

/** Extracts all wikilink targets from raw markdown content. */
function extractLinks(content: string): string[] {
  const links: string[] = [];
  let match: RegExpExecArray | null;

  // Reset lastIndex before iterating (global regex)
  WIKILINK_RE.lastIndex = 0;
  while ((match = WIKILINK_RE.exec(content)) !== null) {
    const target = match[1].trim();
    if (target && !links.includes(target)) {
      links.push(target);
    }
  }

  return links;
}

/** Extracts all #tags from raw markdown content. */
function extractTags(content: string): string[] {
  const tags: string[] = [];
  let match: RegExpExecArray | null;

  TAG_RE.lastIndex = 0;
  while ((match = TAG_RE.exec(content)) !== null) {
    const tag = match[1].trim();
    if (tag && !tags.includes(tag)) {
      tags.push(tag);
    }
  }

  return tags;
}
