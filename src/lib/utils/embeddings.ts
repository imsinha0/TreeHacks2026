import OpenAI from 'openai';

/**
 * Generate embeddings for text content using OpenAI's embedding API
 */
export async function generateEmbedding(
  text: string,
  apiKey: string
): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    throw new Error('Text cannot be empty');
  }

  const openai = new OpenAI({ apiKey });

  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small', // 1536 dimensions, fast and cost-effective
      input: text.trim(),
    });

    if (!response.data || response.data.length === 0) {
      throw new Error('No embedding returned from OpenAI');
    }

    return response.data[0].embedding;
  } catch (error) {
    console.error('Failed to generate embedding:', error);
    throw new Error(
      `Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Generate embeddings for multiple texts in batch
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  apiKey: string,
  batchSize: number = 10
): Promise<number[][]> {
  const embeddings: number[][] = [];
  
  // Process in batches to avoid rate limits
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchPromises = batch.map((text) => generateEmbedding(text, apiKey));
    const batchResults = await Promise.all(batchPromises);
    embeddings.push(...batchResults);
    
    // Small delay between batches to respect rate limits
    if (i + batchSize < texts.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  
  return embeddings;
}

