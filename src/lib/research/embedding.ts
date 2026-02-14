import OpenAI from 'openai';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

/**
 * Generate an embedding vector for a single text string.
 */
export async function generateEmbedding(
  text: string,
  apiKey: string
): Promise<number[]> {
  const client = new OpenAI({ apiKey });

  try {
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
      dimensions: EMBEDDING_DIMENSIONS,
    });

    const embedding = response.data[0]?.embedding;
    if (!embedding) {
      throw new Error('No embedding returned from OpenAI API');
    }

    return embedding;
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      throw new Error(
        `OpenAI embedding API error (${error.status}): ${error.message}`
      );
    }
    throw new Error(
      `Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Generate embedding vectors for multiple text strings in a single batch request.
 */
export async function generateEmbeddings(
  texts: string[],
  apiKey: string
): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const client = new OpenAI({ apiKey });

  try {
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: texts,
      dimensions: EMBEDDING_DIMENSIONS,
    });

    // Sort by index to ensure correct ordering
    const sorted = response.data.sort((a, b) => a.index - b.index);

    return sorted.map((item) => item.embedding);
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      throw new Error(
        `OpenAI embeddings API error (${error.status}): ${error.message}`
      );
    }
    throw new Error(
      `Failed to generate embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
