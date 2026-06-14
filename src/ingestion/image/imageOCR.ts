import type { App, TFile } from 'obsidian';
import type { IngestedEntity, IngestionProgressCallback } from '../shared/types';
import type { IngestionCache } from '../shared/cache';
import { readCachedExtraction } from '../shared/cache';
import { sanitizeText, batchArray, delay, createProgressTracker, lazyLoad } from '../shared/utils';

const getTesseract = lazyLoad(() => import('tesseract.js'));

// The scheduler is not a plain memoized import: it owns a worker that
// terminateOCR() tears down and resets, so it keeps its own mutable handle.
let tesseractScheduler: import('tesseract.js').Scheduler | null = null;

async function getScheduler(): Promise<import('tesseract.js').Scheduler> {
  if (!tesseractScheduler) {
    const Tesseract = await getTesseract();
    tesseractScheduler = await Tesseract.createScheduler();
    const worker = await Tesseract.createWorker('eng');
    tesseractScheduler.addWorker(worker);
  }
  return tesseractScheduler;
}

export interface OCRMetadata extends Record<string, unknown> {
  confidence: number;
  words: number;
  language: string;
  processingTimeMs?: number;
}

export async function terminateOCR(): Promise<void> {
  if (tesseractScheduler) {
    await tesseractScheduler.terminate();
    tesseractScheduler = null;
  }
}

export async function extractImageText(
  app: App,
  file: TFile,
  cache?: IngestionCache
): Promise<{ text: string; metadata: OCRMetadata } | null> {
  const startTime = Date.now();
  
  try {
    const cached = readCachedExtraction<OCRMetadata>(cache, file.path, file.stat.mtime);
    if (cached) return cached;

    const MAX_SIZE_MB = 10;
    if (file.stat.size > MAX_SIZE_MB * 1024 * 1024) {
      console.warn(`[ogi] Image ${file.path} too large for OCR (> ${MAX_SIZE_MB}MB)`);
      return null;
    }

    const arrayBuffer = await app.vault.adapter.readBinary(file.path);
    const base64 = arrayBufferToBase64(arrayBuffer);
    const dataUrl = `data:image/${getImageMimeType(file.extension)};base64,${base64}`;

    const scheduler = await getScheduler();
    const result = await scheduler.addJob('recognize', dataUrl);

    const text = sanitizeText(result.data.text, 5000);
    const metadata: OCRMetadata = {
      confidence: result.data.confidence,
      words: result.data.words.length,
      language: 'eng',
      processingTimeMs: Date.now() - startTime,
    };

    if (metadata.confidence < 30 || text.length < 10) {
      return {
        text: '',
        metadata: { ...metadata, confidence: 0, words: 0 },
      };
    }

    if (cache) {
      cache.set(file.path, text, metadata, file.stat.mtime);
    }

    return { text, metadata };
  } catch (err) {
    console.error(`[ogi] Failed to OCR image ${file.path}:`, err);
    return null;
  }
}

export async function imageToEntity(
  app: App,
  file: TFile,
  cache?: IngestionCache
): Promise<IngestedEntity | null> {
  const extracted = await extractImageText(app, file, cache);
  
  const text = extracted?.text || '';
  const metadata = extracted?.metadata || {
    confidence: 0,
    words: 0,
    language: 'eng',
  };

  return {
    id: file.path,
    title: file.basename,
    sourceType: 'image',
    sourcePath: file.path,
    content: text,
    mtime: file.stat.mtime,
    metadata: {
      ...metadata,
      fileSize: file.stat.size,
      extension: file.extension,
      hasOCR: text.length > 0,
    },
    tags: text.length > 0 ? ['ocr-processed'] : ['image-no-text'],
  };
}

export async function processImageBatch(
  app: App,
  files: TFile[],
  cache: IngestionCache,
  onProgress?: IngestionProgressCallback,
  batchSize = 3,
  batchDelayMs = 500
): Promise<IngestedEntity[]> {
  const entities: IngestedEntity[] = [];
  const batches = batchArray(files, batchSize);
  const progress = createProgressTracker(files.length, onProgress);

  let processed = 0;
  for (const batch of batches) {
    const batchPromises = batch.map(async (file) => {
      const entity = await imageToEntity(app, file, cache);
      processed++;
      progress.update(processed, file.name);
      return entity;
    });

    const batchResults = await Promise.all(batchPromises);
    entities.push(...batchResults.filter((e): e is IngestedEntity => e !== null));

    if (batchDelayMs > 0) {
      await delay(batchDelayMs);
    }
  }

  progress.update(processed, undefined, 'completed');
  return entities;
}

export function getImageFiles(app: App): TFile[] {
  const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tiff'];
  return app.vault.getFiles().filter((f) => 
    imageExtensions.includes(f.extension.toLowerCase())
  );
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function getImageMimeType(extension: string): string {
  const mimeTypes: Record<string, string> = {
    png: 'png',
    jpg: 'jpeg',
    jpeg: 'jpeg',
    gif: 'gif',
    webp: 'webp',
    bmp: 'bmp',
    tiff: 'tiff',
    tif: 'tiff',
  };
  return mimeTypes[extension.toLowerCase()] || 'jpeg';
}
