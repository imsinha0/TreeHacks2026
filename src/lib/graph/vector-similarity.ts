import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Generate similarity edges between a document and other documents in the same debate.
 * Wraps the Supabase `generate_similarity_edges` RPC.
 *
 * @returns The number of similarity edges created.
 */
export async function generateSimilarityEdges(
  supabase: SupabaseClient,
  documentId: string,
  debateId: string,
  threshold: number = 0.7
): Promise<number> {
  const { data, error } = await supabase.rpc('generate_similarity_edges', {
    p_doc_id: documentId,
    p_debate_id: debateId,
    p_threshold: threshold,
  });

  if (error) {
    throw new Error(`Failed to generate similarity edges: ${error.message}`);
  }

  return (data as number) ?? 0;
}

/**
 * Find documents similar to a query embedding within a debate.
 * Wraps the Supabase `find_similar_documents` RPC.
 */
export async function findSimilarDocuments(
  supabase: SupabaseClient,
  debateId: string,
  queryEmbedding: number[],
  limit: number = 5,
  threshold: number = 0.7
): Promise<
  Array<{
    id: string;
    title: string;
    summary: string;
    content: string;
    source_url: string;
    similarity: number;
  }>
> {
  const { data, error } = await supabase.rpc('find_similar_documents', {
    p_debate_id: debateId,
    p_query_embedding: queryEmbedding,
    p_limit: limit,
    p_threshold: threshold,
  });

  if (error) {
    throw new Error(`Failed to find similar documents: ${error.message}`);
  }

  return (data ?? []) as Array<{
    id: string;
    title: string;
    summary: string;
    content: string;
    source_url: string;
    similarity: number;
  }>;
}
