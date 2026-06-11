import type { App, TFile } from 'obsidian';
import type { IngestedEntity, IngestionProgressCallback } from '../shared/types';
import type { IngestionCache } from '../shared/cache';
import { readCachedExtraction } from '../shared/cache';
import { sanitizeText, batchArray, delay, createProgressTracker, lazyLoad } from '../shared/utils';

const getPdfJs = lazyLoad(async () => {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = '';
  return pdfjs;
});

export interface PDFMetadata extends Record<string, unknown> {
  title?: string;
  author?: string;
  subject?: string;
  creationDate?: string;
  pageCount: number;
}

export async function extractPDFText(
  app: App,
  file: TFile,
  cache?: IngestionCache
): Promise<{ text: string; metadata: PDFMetadata } | null> {
  try {
    const cached = readCachedExtraction<PDFMetadata>(cache, file.path, file.stat.mtime);
    if (cached) return cached;

    const pdfjs = await getPdfJs();
    const arrayBuffer = await app.vault.adapter.readBinary(file.path);
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

    const metadata: PDFMetadata = {
      pageCount: pdf.numPages,
    };

    try {
      const docMetadata = await pdf.getMetadata();
      if (docMetadata.info) {
        const info = docMetadata.info as Record<string, string>;
        metadata.title = info.Title;
        metadata.author = info.Author;
        metadata.subject = info.Subject;
        metadata.creationDate = info.CreationDate;
      }
    } catch {
    }

    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: unknown) => {
          const textItem = item as { str?: string };
          return textItem.str || '';
        })
        .join(' ');
      fullText += pageText + '\n';
    }

    const sanitizedText = sanitizeText(fullText, 50000);

    if (cache) {
      cache.set(file.path, sanitizedText, metadata, file.stat.mtime);
    }

    return { text: sanitizedText, metadata };
  } catch (err) {
    console.error(`[ogi] Failed to extract PDF ${file.path}:`, err);
    return null;
  }
}

export async function pdfToEntity(
  app: App,
  file: TFile,
  cache?: IngestionCache
): Promise<IngestedEntity | null> {
  const extracted = await extractPDFText(app, file, cache);
  if (!extracted) return null;

  const { text, metadata } = extracted;

  const title = metadata.title || file.basename;

  return {
    id: file.path,
    title,
    sourceType: 'pdf',
    sourcePath: file.path,
    content: text,
    mtime: file.stat.mtime,
    metadata: {
      ...metadata,
      fileSize: file.stat.size,
    },
    tags: [],
  };
}

export async function processPDFBatch(
  app: App,
  files: TFile[],
  cache: IngestionCache,
  onProgress?: IngestionProgressCallback,
  batchSize = 3,
  batchDelayMs = 200
): Promise<IngestedEntity[]> {
  const entities: IngestedEntity[] = [];
  const batches = batchArray(files, batchSize);
  const progress = createProgressTracker(files.length, onProgress);

  let processed = 0;
  for (const batch of batches) {
    const batchPromises = batch.map(async (file) => {
      const entity = await pdfToEntity(app, file, cache);
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

export function getPDFFiles(app: App): TFile[] {
  return app.vault.getFiles().filter((f) => f.extension.toLowerCase() === 'pdf');
}
