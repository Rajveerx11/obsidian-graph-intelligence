export * from './shared';
export * from './pdf';
export * from './image';
export * from './youtube';

import type { App } from 'obsidian';
import type { IngestedEntity, IngestionConfig, IngestionProgressCallback } from './shared/types';
import type { IngestionCache } from './shared/cache';
import { DEFAULT_INGESTION_CONFIG } from './shared/types';
import { processPDFBatch, getPDFFiles } from './pdf/pdfExtractor';
import { processImageBatch, getImageFiles, terminateOCR } from './image/imageOCR';
import { processYouTubeBatch, getNotesWithYouTubeLinks } from './youtube/transcriptExtractor';

export interface IngestionResult {
  pdfs: IngestedEntity[];
  images: IngestedEntity[];
  youtube: IngestedEntity[];
  total: number;
}

export async function ingestAll(
  app: App,
  cache: IngestionCache,
  config: IngestionConfig = DEFAULT_INGESTION_CONFIG,
  onProgress?: IngestionProgressCallback
): Promise<IngestionResult> {
  const result: IngestionResult = {
    pdfs: [],
    images: [],
    youtube: [],
    total: 0,
  };

  try {
    const pdfFiles = filterByMaxSize(getPDFFiles(app), config.maxFileSizeMB);
    if (pdfFiles.length > 0) {
      result.pdfs = await processPDFBatch(
        app,
        pdfFiles,
        cache,
        onProgress,
        config.batchSize,
        config.batchDelayMs
      );
    }

    if (!config.lazyProcessing) {
      const imageFiles = filterByMaxSize(getImageFiles(app), config.maxFileSizeMB);
      const imagesToProcess = imageFiles.slice(0, 20);
      if (imagesToProcess.length > 0) {
        result.images = await processImageBatch(
          app,
          imagesToProcess,
          cache,
          onProgress,
          Math.min(config.batchSize, 2),
          Math.max(config.batchDelayMs, 1000)
        );
      }
    }

    const notesWithYoutube = await getNotesWithYouTubeLinks(app);
    if (notesWithYoutube.length > 0) {
      result.youtube = await processYouTubeBatch(
        app,
        notesWithYoutube,
        cache,
        onProgress,
        3,
        Math.max(config.batchDelayMs, 2000)
      );
    }

    result.total = result.pdfs.length + result.images.length + result.youtube.length;
    
    await terminateOCR();
    
    await cache.save();
  } catch (err) {
    console.error('[ogi] Ingestion failed:', err);
  }

  return result;
}

export function entityToNoteNode(entity: IngestedEntity): {
  id: string;
  title: string;
  links: string[];
  tags: string[];
  mtime: number;
  contentSnippet: string;
} {
  return {
    id: entity.id,
    title: entity.title,
    links: [],
    tags: entity.tags,
    mtime: entity.mtime,
    contentSnippet: entity.content.substring(0, 2000),
  };
}

function filterByMaxSize<T extends { stat: { size: number } }>(files: T[], maxFileSizeMB: number): T[] {
  const maxBytes = maxFileSizeMB * 1024 * 1024;
  return files.filter((file) => file.stat.size <= maxBytes);
}
