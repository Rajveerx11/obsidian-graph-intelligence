import type { IngestionProgressCallback, IngestionStatus } from './types';

export function batchArray<T>(array: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }
  return batches;
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function createProgressTracker(
  total: number,
  callback?: IngestionProgressCallback
): { update: (current: number, currentFile?: string, status?: IngestionStatus) => void } {
  return {
    update: (current: number, currentFile?: string, status: IngestionStatus = 'processing') => {
      callback?.({
        current,
        total,
        currentFile,
        status,
      });
    },
  };
}

export function sanitizeText(text: string, maxLength = 10000): string {
  return text
    .replace(/\x00/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, maxLength);
}

export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?]+)/,
    /youtube\.com\/shorts\/([^&\s?]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

export function isYouTubeUrl(url: string): boolean {
  return extractYouTubeId(url) !== null;
}

export function safeFilename(text: string): string {
  return text
    .replace(/[^a-zA-Z0-9\-_\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50);
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Memoize an async loader (typically a dynamic `import()`) so it runs at most
 * once. Returns a getter that resolves the cached value on every later call.
 * Replaces the hand-rolled `let mod = null; async get() {...}` pattern in each
 * extractor, and dedupes concurrent in-flight loads (batch processing kicks off
 * many extractions at once, which previously could trigger redundant imports).
 */
export function lazyLoad<T>(loader: () => Promise<T>): () => Promise<T> {
  let value: T | null = null;
  let pending: Promise<T> | null = null;
  return async () => {
    if (value !== null) return value;
    if (!pending) {
      pending = loader().then(
        (v) => {
          value = v;
          pending = null;
          return v;
        },
        (err) => {
          // Reset the slot so a failed load (bundling issue, memory pressure,
          // missing worker) can be retried on the next call instead of being
          // permanently stuck on the rejected promise.
          pending = null;
          throw err;
        }
      );
    }
    return pending;
  };
}
