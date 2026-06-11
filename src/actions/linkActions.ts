/**
 * Action Layer - Link & Open Actions
 *
 * Functions for linking notes together and opening notes in the editor.
 * All functions use the Obsidian API exclusively (no direct FS access)
 * and return ActionResult for consistent UI feedback.
 */

import type { App, TFile } from 'obsidian';
import type { ActionResult } from './actionTypes';
import { resolveFile, titleFromPath, openInTab, failResult } from './vaultUtils';

const WIKILINK_RE = /\[\[([^\]|#]+)(?:[|#][^\]]*)?(?:\|[^\]]*)?\]\]/g;
const MANAGED_LINKS_HEADING = '## Graph Intelligence Links';

function hasExistingLinkToFile(
  app: App,
  content: string,
  sourcePath: string,
  targetFile: TFile,
): boolean {
  WIKILINK_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = WIKILINK_RE.exec(content)) !== null) {
    const rawTarget = match[1].trim();
    const resolved = app.metadataCache.getFirstLinkpathDest(rawTarget, sourcePath);
    if (resolved?.path === targetFile.path) return true;

    if (
      rawTarget.toLowerCase() === targetFile.basename.toLowerCase() ||
      rawTarget.toLowerCase() === targetFile.path.replace(/\.md$/i, '').toLowerCase()
    ) {
      return true;
    }
  }

  return false;
}

function appendManagedLink(content: string, linkText: string): string {
  const bullet = `- [[${linkText}]]`;
  const separator = content.endsWith('\n') ? '' : '\n';

  if (content.includes(MANAGED_LINKS_HEADING)) {
    return `${content}${separator}${bullet}\n`;
  }

  const sectionSeparator = content.trim().length > 0 ? `${separator}\n` : '';
  return `${content}${sectionSeparator}${MANAGED_LINKS_HEADING}\n\n${bullet}\n`;
}

async function ensureLink(
  app: App,
  sourceFile: TFile,
  targetFile: TFile,
): Promise<boolean> {
  const content = await app.vault.read(sourceFile);
  if (hasExistingLinkToFile(app, content, sourceFile.path, targetFile)) {
    return false;
  }

  const linkText = app.metadataCache.fileToLinktext(targetFile, sourceFile.path, true);
  await app.vault.modify(sourceFile, appendManagedLink(content, linkText));
  return true;
}

/**
 * Creates wikilinks between the source note and the target note.
 *
 * - Resolves both notes via vault API
 * - Checks for duplicate links in both files before inserting
 * - Appends missing links in a managed "Graph Intelligence Links" section
 * - Saves modified files immediately
 *
 * @returns ActionResult with success/failure and a descriptive message.
 */
export async function linkNotes(
  app: App,
  sourceNoteId: string,
  targetNoteId: string,
): Promise<ActionResult> {
  try {
    const sourceFile = resolveFile(app, sourceNoteId);
    if (!sourceFile) {
      return { success: false, message: `Source note not found: "${titleFromPath(sourceNoteId)}"` };
    }

    const targetFile = resolveFile(app, targetNoteId);
    if (!targetFile) {
      return { success: false, message: `Target note not found: "${titleFromPath(targetNoteId)}"` };
    }

    if (sourceFile.path === targetFile.path) {
      return { success: false, message: 'Cannot link a note to itself.' };
    }

    const sourceChanged = await ensureLink(app, sourceFile, targetFile);
    const targetChanged = await ensureLink(app, targetFile, sourceFile);

    if (!sourceChanged && !targetChanged) {
      return {
        success: true,
        message: `"${sourceFile.basename}" and "${targetFile.basename}" were already connected.`,
      };
    }

    return {
      success: true,
      message: `Connected "${sourceFile.basename}" and "${targetFile.basename}".`,
    };
  } catch (err) {
    return failResult('linkNotes', 'create link', err);
  }
}

/**
 * Opens one or more notes in the editor.
 *
 * Each note opens in a new tab. The last note opened receives focus.
 *
 * @returns ActionResult - always succeeds unless no valid notes are found.
 */
export async function openNotes(
  app: App,
  noteIds: string[],
): Promise<ActionResult> {
  try {
    const files: TFile[] = [];

    for (const id of noteIds) {
      const file = resolveFile(app, id);
      if (file) files.push(file);
    }

    if (files.length === 0) {
      return { success: false, message: 'No valid notes found to open.' };
    }

    for (const file of files) {
      await openInTab(app, file);
    }

    return {
      success: true,
      message: `Opened ${files.length} note${files.length > 1 ? 's' : ''}.`,
    };
  } catch (err) {
    return failResult('openNotes', 'open notes', err);
  }
}
