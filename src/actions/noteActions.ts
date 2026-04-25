/**
 * Action Layer — Note Creation Actions
 *
 * Functions for creating new notes and bridge notes in the vault.
 * All functions use the Obsidian API exclusively and return ActionResult.
 */

import type { App, TFile } from 'obsidian';
import type { ActionResult } from './actionTypes';

// ── Helpers ────────────────────────────────────────────────────────────

/** Strips characters that are invalid in filenames across all platforms. */
function sanitizeFilename(title: string): string {
  return title
    .replace(/[\\/:*?"<>|]/g, '-')  // Replace invalid chars with dash
    .replace(/\s+/g, ' ')            // Normalize whitespace
    .trim();
}

/** Extracts the display title from a file path (basename without .md). */
function titleFromPath(path: string): string {
  return path.replace(/\.md$/, '').split('/').pop() ?? path;
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Creates a new note in the vault root.
 *
 * - Sanitizes title for a valid filename
 * - Prevents overwriting existing files
 * - Optionally pre-fills content
 * - Opens the new note in the editor
 *
 * @returns ActionResult with success/failure and a descriptive message.
 */
export async function createNote(
  app: App,
  title: string,
  content?: string,
): Promise<ActionResult> {
  try {
    const safeTitle = sanitizeFilename(title);
    if (!safeTitle) {
      return { success: false, message: 'Invalid note title.' };
    }

    const filePath = `${safeTitle}.md`;

    // Check if note already exists
    const existing = app.vault.getAbstractFileByPath(filePath);
    if (existing) {
      return { success: false, message: `Note "${safeTitle}" already exists.` };
    }

    // Create the file
    const file = await app.vault.create(filePath, content ?? '');

    // Open in editor
    const leaf = app.workspace.getLeaf('tab');
    await leaf.openFile(file as TFile);

    return {
      success: true,
      message: `Created note "${safeTitle}".`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[ogi:action] createNote failed:', msg);
    return { success: false, message: `Failed to create note: ${msg}` };
  }
}

/**
 * Creates a bridge note that connects two related notes.
 *
 * The bridge note:
 * - Has a descriptive title derived from both notes
 * - Contains wikilinks to both notes
 * - Includes a template explaining the connection
 * - Opens in the editor after creation
 *
 * @returns ActionResult with success/failure and a descriptive message.
 */
export async function createBridgeNote(
  app: App,
  noteAId: string,
  noteBId: string,
): Promise<ActionResult> {
  try {
    const titleA = titleFromPath(noteAId);
    const titleB = titleFromPath(noteBId);

    const bridgeTitle = sanitizeFilename(`Bridge — ${titleA} ↔ ${titleB}`);
    if (!bridgeTitle) {
      return { success: false, message: 'Could not generate a valid bridge note title.' };
    }

    const filePath = `${bridgeTitle}.md`;

    // Check if bridge note already exists
    const existing = app.vault.getAbstractFileByPath(filePath);
    if (existing) {
      return { success: false, message: `Bridge note "${bridgeTitle}" already exists.` };
    }

    // Build template content
    const content = [
      `# ${titleA} ↔ ${titleB}`,
      '',
      '> This bridge note connects two related concepts that were identified',
      '> as a knowledge gap by Graph Intelligence.',
      '',
      '## Connected Notes',
      '',
      `- [[${titleA}]]`,
      `- [[${titleB}]]`,
      '',
      '## Connection',
      '',
      `Describe how **${titleA}** and **${titleB}** relate to each other:`,
      '',
      '- ',
      '',
      '## Key Insights',
      '',
      '- ',
      '',
    ].join('\n');

    // Create the file
    const file = await app.vault.create(filePath, content);

    // Open in editor
    const leaf = app.workspace.getLeaf('tab');
    await leaf.openFile(file as TFile);

    return {
      success: true,
      message: `Created bridge note "${bridgeTitle}".`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[ogi:action] createBridgeNote failed:', msg);
    return { success: false, message: `Failed to create bridge note: ${msg}` };
  }
}
