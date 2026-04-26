/**
 * Semantic Embedding Pipeline using Transformers.js
 * 
 * Runs entirely locally using Xenova/all-MiniLM-L6-v2.
 * The model is loaded lazily only when requested.
 */

class PipelineSingleton {
  static task = 'feature-extraction' as const;
  static model = 'Xenova/all-MiniLM-L6-v2';
  static instance: unknown = null;

  static async getInstance(progressCallback?: (progress: unknown) => void) {
    if (this.instance === null) {
      // Dynamically import to avoid blocking plugin startup and fix load errors
      const transformers = await import('@xenova/transformers');
      
      // Ensure it downloads from HuggingFace CDN and caches via browser Cache API
      transformers.env.allowLocalModels = false;
      transformers.env.useBrowserCache = true;
      
      this.instance = await transformers.pipeline(this.task, this.model, {
        progress_callback: progressCallback
      });
    }
    return this.instance;
  }
}

/**
 * Computes a normalized embedding vector for a given text snippet.
 */
export async function computeEmbedding(text: string): Promise<number[]> {
  if (!text.trim()) {
    return []; // Return empty for empty notes
  }

  const extractor = await PipelineSingleton.getInstance();
  const output = await (extractor as CallableFunction)(text, { pooling: 'mean', normalize: true });

  // Guard against unexpected output shapes from the model
  if (!output || typeof output !== 'object' || !('data' in output) || !output.data) {
    throw new Error('[ogi] Embedding model returned unexpected output shape.');
  }

  // output.data is a Float32Array, convert to standard JS array for storage
  return Array.from(output.data as Float32Array);
}
