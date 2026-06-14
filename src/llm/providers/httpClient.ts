/**
 * Shared HTTP plumbing for the LLM providers.
 *
 * Each provider keeps its own endpoint, auth headers, request body, and
 * response parsing (all genuinely provider-specific). What they share — and
 * previously copy-pasted four ways with subtle drift — lives here: abort/timeout
 * handling, abort-error detection, and uniform failed-response diagnostics.
 */

/** True when an error is an AbortController-triggered timeout/cancellation. */
export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

/** Read a failed response's body as text for diagnostics; never throws. */
export function readErrorBody(response: Response): Promise<string> {
  return response.text().catch(() => 'Unknown error');
}

/**
 * Throw a uniform, body-included error when a response is not OK. Used by every
 * provider's generateText so failures from all four surface the same way
 * (previously some discarded the error body, losing useful diagnostics).
 */
export async function throwIfNotOk(response: Response, provider: string): Promise<void> {
  if (response.ok) return;
  const body = await readErrorBody(response);
  throw new Error(`${provider} request failed (${response.status}): ${body}`);
}

/**
 * fetch() with an AbortController-based timeout, always clearing the timer.
 * Used by the connection tests, which need a hard cap; generateText
 * deliberately does not impose one (LLM generation can run long).
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
