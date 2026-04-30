/**
 * Barrel export for the Action Layer.
 */

// ── Types ──────────────────────────────────────────────────────────────
export type { ActionOptions, ActionResult } from './actionTypes';

// ── Actions ────────────────────────────────────────────────────────────
export { linkNotes, openNotes } from './linkActions';
export { createNote, createBridgeNote } from './noteActions';
export { GRAPH_CONTEXT_NOTE_PATH, reconnectNotesToGraphContext } from './contextActions';
