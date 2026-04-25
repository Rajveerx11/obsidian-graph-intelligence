/**
 * Barrel export for the Action Layer.
 */

// ── Types ──────────────────────────────────────────────────────────────
export type { ActionResult } from './actionTypes';

// ── Actions ────────────────────────────────────────────────────────────
export { linkNotes, openNotes } from './linkActions';
export { createNote, createBridgeNote } from './noteActions';
