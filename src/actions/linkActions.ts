/**
 * Action Layer — Link & Open Actions
 *
 * Functions for linking notes together and opening notes in the editor.
 * All functions use the Obsidian API exclusively (no direct FS access)
 * and return ActionResult for consistent UI feedback.
 */

import type { App, TFile } from 'obsidian';
import type { ActionResult } from './actionTypes';

// ── Helpers ────────────────────────────────────────────────────────────

/** Resolves a vault-relative path to a TFile, or returns null. */
function resolveFile(app: App, noteId: string): TFile | null {
  const abstract = app.vault.getAbstractFileByPath(noteId);
  if (!abstract || !('extension' in abstract)) return null;
  return abstract as TFile;
}

/** Extracts the display title from a file path (basename without .md). */
function titleFromPath(path: string): string {
  return path.replace(/\.md$/, '').split('/').pop() ?? path;
}

/**
 * Regex to detect an existing wikilink to the target note.
 * Matches [[Title]], [[Title|alias]], and [[Title#heading]].
 */
function hasExistingLink(content: string, targetTitle: string): boolean {
  // Escape regex special chars in the title
  const escaped = targetTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\[\\[${escaped}(?:[|#][^\\]]*)?\\]\\]`, 'i');
  return re.test(content);
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Creates a wikilink from the source note to the target note.
 *
 * - Resolves both notes via vault API
 * - Checks for duplicate links before inserting
 * - Appends `[[Target Title]]` at the end of the source file
 * - Saves the file immediately
 *
 * @returns ActionResult with success/failure and a descriptive message.
 */
export async function linkNotes(
  app: App,
  sourceNoteId: string,
  targetNoteId: string,
): Promise<ActionResult> {
  try {
    // Resolve files
    const sourceFile = resolveFile(app, sourceNoteId);
    if (!sourceFile) {
      return { success: false, message: `Source note not found: "${titleFromPath(sourceNoteId)}"` };
    }

    const targetFile = resolveFile(app, targetNoteId);
    if (!targetFile) {
      return { success: false, message: `Target note not found: "${titleFromPath(targetNoteId)}"` };
    }

    // Prevent self-linking
    if (sourceFile.path === targetFile.path) {
      return { success: false, message: 'Cannot link a note to itself.' };
    }

    const targetTitle = targetFile.basename;

    // Read source content
    const content = await app.vault.read(sourceFile);

    // Check for duplicate link
    if (hasExistingLink(content, targetTitle)) {
      return { success: false, message: `Link to "${targetTitle}" already exists.` };
    }

    // Append the wikilink (with a newline separator)
    const separator = content.endsWith('\n') ? '' : '\n';
    const updatedContent = `${content}${separator}\n[[${targetTitle}]]\n`;

    // Save
    await app.vault.modify(sourceFile, updatedContent);

    return {
      success: true,
      message: `Linked "${sourceFile.basename}" → "${targetTitle}"`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[ogi:action] linkNotes failed:', msg);
    return { success: false, message: `Failed to create link: ${msg}` };
  }
}

/**
 * Opens one or more notes in the editor.
 *
 * Each note opens in a new tab. The last note opened receives focus.
 *
 * @returns ActionResult — always succeeds unless no valid notes are found.
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
      const leaf = app.workspace.getLeaf('tab');
      await leaf.openFile(file);
    }

    return {
      success: true,
      message: `Opened ${files.length} note${files.length > 1 ? 's' : ''}.`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[ogi:action] openNotes failed:', msg);
    return { success: false, message: `Failed to open notes: ${msg}` };
  }
}
