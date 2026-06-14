/**
 * Shared mechanics for the action layer.
 *
 * These are the operational helpers every action needs — file resolution,
 * opening a note, deriving a title, and uniform error-result wrapping — that
 * were previously duplicated across linkActions, noteActions, and contextActions.
 * Domain logic (link parsing, templates, managed blocks) stays in each action.
 */
import type { App, TFile } from 'obsidian';
import type { ActionResult } from './actionTypes';

/** Resolves a vault-relative path to a TFile, or returns null. */
export function resolveFile(app: App, noteId: string): TFile | null {
  const abstract = app.vault.getAbstractFileByPath(noteId);
  if (!abstract || !('extension' in abstract)) return null;
  return abstract as TFile;
}

/** Extracts the display title from a file path (basename without .md). */
export function titleFromPath(path: string): string {
  return path.replace(/\.md$/, '').split('/').pop() ?? path;
}

/** Opens a file in a new editor tab. */
export async function openInTab(app: App, file: TFile): Promise<void> {
  const leaf = app.workspace.getLeaf('tab');
  await leaf.openFile(file);
}

/**
 * Builds a uniform failure ActionResult: logs `[ogi:action] <fnName> failed`
 * and returns `Failed to <userAction>: <message>`. Centralizes the catch-block
 * boilerplate every action repeated verbatim.
 */
export function failResult(fnName: string, userAction: string, err: unknown): ActionResult {
  const msg = err instanceof Error ? err.message : 'Unknown error';
  console.error(`[ogi:action] ${fnName} failed:`, msg);
  return { success: false, message: `Failed to ${userAction}: ${msg}` };
}
