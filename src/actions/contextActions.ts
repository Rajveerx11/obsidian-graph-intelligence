/**
 * Action Layer - Graph Intelligence context note maintenance.
 */

import type { App, TFile } from 'obsidian';
import { linkNotes } from './linkActions';
import type { ActionResult } from './actionTypes';
import { resolveFile, failResult } from './vaultUtils';

export const GRAPH_CONTEXT_NOTE_PATH = 'Graph Intelligence Context.md';

const BLOCK_START = '<!-- graph-intelligence-context:start -->';
const BLOCK_END = '<!-- graph-intelligence-context:end -->';

function uniqueFiles(app: App, noteIds: string[]): TFile[] {
  const seen = new Set<string>();
  const files: TFile[] = [];

  for (const noteId of noteIds) {
    const file = resolveFile(app, noteId);
    if (!file || file.path === GRAPH_CONTEXT_NOTE_PATH || seen.has(file.path)) continue;
    seen.add(file.path);
    files.push(file);
  }

  return files;
}

function buildManagedBlock(app: App, contextFile: TFile, files: TFile[]): string {
  const links = files
    .sort((a, b) => a.basename.localeCompare(b.basename))
    .map((file) => {
      const linkText = app.metadataCache.fileToLinktext(file, contextFile.path, true);
      return `- [[${linkText}]]`;
    });

  return [
    BLOCK_START,
    '## Reconnected Notes',
    '',
    'These notes were connected by Graph Intelligence because they needed a stable graph context after automated vault repair.',
    '',
    ...links,
    BLOCK_END,
  ].join('\n');
}

function replaceManagedBlock(content: string, block: string): string {
  const startIdx = content.indexOf(BLOCK_START);
  const endIdx = content.indexOf(BLOCK_END);

  if (startIdx >= 0 && endIdx > startIdx) {
    const before = content.slice(0, startIdx).trimEnd();
    const after = content.slice(endIdx + BLOCK_END.length).trimStart();
    return [before, block, after].filter(Boolean).join('\n\n') + '\n';
  }

  const prefix = content.trim().length > 0 ? `${content.trimEnd()}\n\n` : '';
  return `${prefix}${block}\n`;
}

async function ensureContextFile(app: App): Promise<TFile> {
  const existing = resolveFile(app, GRAPH_CONTEXT_NOTE_PATH);
  if (existing) return existing;

  const file = await app.vault.create(
    GRAPH_CONTEXT_NOTE_PATH,
    [
      '# Graph Intelligence Context',
      '',
      'This note is maintained by Graph Intelligence to keep automated vault repairs visible and connected.',
      '',
    ].join('\n'),
  );

  return file as TFile;
}

export async function reconnectNotesToGraphContext(
  app: App,
  noteIds: string[],
): Promise<ActionResult> {
  try {
    const files = uniqueFiles(app, noteIds);
    if (files.length === 0) {
      return { success: false, message: 'No valid notes were available for context reconnection.' };
    }

    const contextFile = await ensureContextFile(app);
    const existingContent = await app.vault.read(contextFile);
    const updatedContent = replaceManagedBlock(existingContent, buildManagedBlock(app, contextFile, files));
    if (updatedContent !== existingContent) {
      await app.vault.modify(contextFile, updatedContent);
    }

    let connected = 0;
    for (const file of files) {
      const result = await linkNotes(app, file.path, contextFile.path);
      if (result.success) connected++;
    }

    return {
      success: connected > 0,
      message: `Reconnected ${connected} note${connected === 1 ? '' : 's'} through "${contextFile.basename}".`,
    };
  } catch (err) {
    return failResult('reconnectNotesToGraphContext', 'update graph context', err);
  }
}
