import type { App, TFile } from 'obsidian';
import type { IngestedEntity, IngestionProgressCallback } from '../shared/types';
import type { IngestionCache } from '../shared/cache';
import { readCachedExtraction } from '../shared/cache';
import { sanitizeText, extractYouTubeId, delay, batchArray, createProgressTracker, lazyLoad } from '../shared/utils';

const getYouTubeTranscript = lazyLoad(() => import('youtube-transcript'));

// A remote video's transcript has no local mtime to compare against, and the
// captions for a given video ID are effectively immutable, so transcripts are
// cached indefinitely. Version 0 makes every cache lookup a hit once stored.
const TRANSCRIPT_CACHE_VERSION = 0;

export interface TranscriptMetadata extends Record<string, unknown> {
  videoId: string;
  videoUrl: string;
  language: string;
  durationSeconds?: number;
  isGenerated: boolean;
  fetchedAt: number;
}

export async function extractYouTubeTranscript(
  videoId: string,
  cache?: IngestionCache,
  cacheKey?: string
): Promise<{ text: string; metadata: TranscriptMetadata } | null> {
  try {
    const cacheId = cacheKey || `youtube:${videoId}`;

    const cached = readCachedExtraction<TranscriptMetadata>(cache, cacheId, TRANSCRIPT_CACHE_VERSION);
    if (cached) return cached;

    const YT = await getYouTubeTranscript();
    
    const transcriptItems = await YT.YoutubeTranscript.fetchTranscript(videoId);
    
    if (!transcriptItems || transcriptItems.length === 0) {
      return null;
    }

    const fullText = transcriptItems.map(item => item.text).join(' ');
    const sanitizedText = sanitizeText(fullText, 30000);

    const lastItem = transcriptItems[transcriptItems.length - 1];
    const durationSeconds = lastItem ? (lastItem.offset + lastItem.duration) / 1000 : undefined;

    const metadata: TranscriptMetadata = {
      videoId,
      videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
      language: 'auto-detected',
      durationSeconds,
      isGenerated: true,
      fetchedAt: Date.now(),
    };

    if (cache) {
      cache.set(cacheId, sanitizedText, metadata, TRANSCRIPT_CACHE_VERSION);
    }

    return { text: sanitizedText, metadata };
  } catch (err) {
    console.error(`[ogi] Failed to fetch YouTube transcript for ${videoId}:`, err);
    return null;
  }
}

export async function youtubeToEntity(
  videoUrl: string,
  sourceNotePath: string,
  cache?: IngestionCache
): Promise<IngestedEntity | null> {
  const videoId = extractYouTubeId(videoUrl);
  if (!videoId) return null;

  const extracted = await extractYouTubeTranscript(videoId, cache, `${sourceNotePath}:${videoId}`);
  if (!extracted) return null;

  const { text, metadata } = extracted;

  return {
    id: `youtube:${videoId}`,
    title: `YouTube Video ${videoId}`,
    sourceType: 'youtube',
    sourcePath: videoUrl,
    content: text,
    mtime: Date.now(),
    metadata: {
      ...metadata,
      sourceNote: sourceNotePath,
    },
    tags: ['youtube', 'transcript', 'video'],
  };
}

export async function extractYouTubeFromNote(
  app: App,
  file: TFile,
  cache: IngestionCache
): Promise<IngestedEntity[]> {
  const entities: IngestedEntity[] = [];
  
  try {
    const content = await app.vault.cachedRead(file);
    
    const urlPattern = /https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)[^\s\]\)>]+/g;
    const urls = [...content.matchAll(urlPattern)].map(match => match[0]);
    
    const uniqueUrls = [...new Set(urls)];
    
    for (const url of uniqueUrls) {
      try {
        await delay(500);
        
        const entity = await youtubeToEntity(url, file.path, cache);
        if (entity) {
          entities.push(entity);
        }
      } catch (err) {
        console.warn(`[ogi] Failed to extract YouTube from URL ${url}:`, err);
      }
    }
  } catch (err) {
    console.error(`[ogi] Failed to scan note ${file.path} for YouTube URLs:`, err);
  }
  
  return entities;
}

export async function processYouTubeBatch(
  app: App,
  files: TFile[],
  cache: IngestionCache,
  onProgress?: IngestionProgressCallback,
  batchSize = 5,
  batchDelayMs = 1000
): Promise<IngestedEntity[]> {
  const entities: IngestedEntity[] = [];
  const batches = batchArray(files, batchSize);
  const progress = createProgressTracker(files.length, onProgress);

  let processed = 0;
  for (const batch of batches) {
    for (const file of batch) {
      const fileEntities = await extractYouTubeFromNote(app, file, cache);
      entities.push(...fileEntities);
      processed++;
      progress.update(processed, file.name);
      
      await delay(200);
    }

    if (batchDelayMs > 0) {
      await delay(batchDelayMs);
    }
  }

  progress.update(processed, undefined, 'completed');
  return entities;
}

export async function getNotesWithYouTubeLinks(app: App): Promise<TFile[]> {
  const markdownFiles = app.vault.getMarkdownFiles();
  const candidates: TFile[] = [];
  
  for (const file of markdownFiles) {
    try {
      const content = await app.vault.cachedRead(file);
      if (content.includes('youtube.com') || content.includes('youtu.be')) {
        candidates.push(file);
      }
    } catch {
    }
  }
  
  return candidates;
}
