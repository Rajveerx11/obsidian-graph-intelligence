/**
 * Action Layer — Shared Type Definitions
 *
 * All action functions return an ActionResult to provide
 * consistent success/failure feedback to the UI layer.
 */

/** The result of any user-initiated action (link, create, open). */
export interface ActionResult {
  /** Whether the action completed successfully. */
  success: boolean;
  /** Human-readable feedback message for the UI. */
  message: string;
}

/** Optional behavior flags for actions that may open editor tabs. */
export interface ActionOptions {
  /** Open touched notes in the editor after the action completes. Defaults to true. */
  open?: boolean;
}
