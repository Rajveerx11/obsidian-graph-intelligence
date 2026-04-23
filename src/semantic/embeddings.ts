/**
 * Semantic Embedding Pipeline using Transformers.js
 * 
 * Runs entirely locally using Xenova/all-MiniLM-L6-v2.
 * The model is loaded lazily only when requested.
 */

class PipelineSingleton {
  static task = 'feature-extraction' as const;
  static model = 'Xenova/all-MiniLM-L6-v2';
  static instance: any = null;

  static async getInstance(progressCallback?: Function) {
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
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  
  // output.data is a Float32Array, convert to standard JS array for storage
  return Array.from(output.data);
}
