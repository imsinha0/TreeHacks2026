import { SupabaseClient } from '@supabase/supabase-js';
import { PerplexityClient } from './perplexity';
import { generateEmbedding } from './embedding';
import { traverseGraphForContext, GraphContext } from './graph-traversal';
import { generateId } from '@/lib/utils/id';

export interface ResearchResults {
  perplexityAnswer: string;
  sources: Array<{ url: string; title: string; snippet: string }>;
  graphContext: GraphContext;
  similarDocuments: Array<{
    id: string;
    title: string;
    summary: string;
    similarity: number;
  }>;
  combinedContext: string;
}

interface SimilarDocumentRow {
  id: string;
  title: string;
  summary: string;
  similarity: number;
}

/**
 * Conduct parallel research using three independent methods:
 * 1. Perplexity web search
 * 2. Knowledge graph traversal
 * 3. pgvector similarity search
 *
 * Each method is non-fatal: if one fails, the others still contribute results.
 * After gathering results, new Perplexity findings are persisted as documents
 * with embeddings for future retrieval.
 */
export async function conductParallelResearch(params: {
  topic: string;
  role: 'pro' | 'con';
  debateId: string;
  researchDepth: 'quick' | 'standard' | 'deep';
  supabase: SupabaseClient;
  perplexityApiKey: string;
  openaiApiKey: string;
}): Promise<ResearchResults> {
  const {
    topic,
    role,
    debateId,
    researchDepth,
    supabase,
    perplexityApiKey,
    openaiApiKey,
  } = params;

  const searchQuery = buildSearchQuery(topic, role);

  // Run all three research methods in parallel
  const [perplexityResult, graphResult, similarDocsResult] = await Promise.all([
    // 1. Perplexity web search
    runPerplexitySearch(perplexityApiKey, searchQuery, researchDepth),

    // 2. Knowledge graph traversal
    runGraphTraversal(supabase, debateId, topic),

    // 3. pgvector similarity search
    runSimilaritySearch(supabase, debateId, topic, openaiApiKey),
  ]);

  // Persist new Perplexity results as documents (non-fatal)
  if (perplexityResult.answer) {
    await persistPerplexityResults(
      supabase,
      debateId,
      perplexityResult,
      openaiApiKey
    ).catch((error) => {
      console.error('Failed to persist Perplexity results:', error);
    });
  }

  // Combine all results into a unified context string
  const combinedContext = buildCombinedContext(
    perplexityResult,
    graphResult,
    similarDocsResult
  );

  return {
    perplexityAnswer: perplexityResult.answer,
    sources: perplexityResult.sources,
    graphContext: graphResult,
    similarDocuments: similarDocsResult,
    combinedContext,
  };
}

/**
 * Build a search query tailored to the debate role.
 */
function buildSearchQuery(topic: string, role: 'pro' | 'con'): string {
  const perspective = role === 'pro' ? 'arguments in favor of' : 'arguments against';
  return `${perspective} ${topic}. Include statistics, expert opinions, and evidence.`;
}

/**
 * Run Perplexity web search. Returns empty results on failure.
 */
async function runPerplexitySearch(
  apiKey: string,
  query: string,
  depth: 'quick' | 'standard' | 'deep'
): Promise<{ answer: string; sources: Array<{ url: string; title: string; snippet: string }> }> {
  try {
    const client = new PerplexityClient(apiKey);
    const result = await client.search(query, depth);
    return { answer: result.answer, sources: result.sources };
  } catch (error) {
    console.error('Perplexity search failed (non-fatal):', error);
    return { answer: '', sources: [] };
  }
}

/**
 * Run knowledge graph traversal. Returns empty context on failure.
 */
async function runGraphTraversal(
  supabase: SupabaseClient,
  debateId: string,
  topic: string
): Promise<GraphContext> {
  try {
    return await traverseGraphForContext(supabase, debateId, topic, 2);
  } catch (error) {
    console.error('Graph traversal failed (non-fatal):', error);
    return {
      relevantNodes: [],
      relevantEdges: [],
      contextSummary: 'Graph traversal unavailable.',
    };
  }
}

/**
 * Run pgvector similarity search using Supabase RPC. Returns empty results on failure.
 */
async function runSimilaritySearch(
  supabase: SupabaseClient,
  debateId: string,
  topic: string,
  openaiApiKey: string
): Promise<SimilarDocumentRow[]> {
  try {
    const queryEmbedding = await generateEmbedding(topic, openaiApiKey);

    const { data, error } = await supabase.rpc('find_similar_documents', {
      query_embedding: queryEmbedding,
      match_debate_id: debateId,
      match_threshold: 0.5,
      match_count: 10,
    });

    if (error) {
      console.error('Similarity search RPC error:', error);
      return [];
    }

    return ((data ?? []) as SimilarDocumentRow[]).map((doc) => ({
      id: doc.id,
      title: doc.title,
      summary: doc.summary,
      similarity: doc.similarity,
    }));
  } catch (error) {
    console.error('Similarity search failed (non-fatal):', error);
    return [];
  }
}

/**
 * Persist Perplexity search results as documents in Supabase.
 * Generates embeddings and creates similarity edges for the new documents.
 */
async function persistPerplexityResults(
  supabase: SupabaseClient,
  debateId: string,
  perplexityResult: {
    answer: string;
    sources: Array<{ url: string; title: string; snippet: string }>;
  },
  openaiApiKey: string
): Promise<void> {
  const newDocIds: string[] = [];

  // Create a document for each source
  for (const source of perplexityResult.sources) {
    if (!source.url) continue;

    const docId = generateId();
    const content = source.snippet || perplexityResult.answer.slice(0, 500);

    try {
      // Generate embedding for this document
      const embedding = await generateEmbedding(content, openaiApiKey);

      // Insert document record
      const { error } = await supabase.from('documents').insert({
        id: docId,
        debate_id: debateId,
        title: source.title || 'Perplexity Source',
        content,
        summary: source.snippet || '',
        source_url: source.url,
        source_type: 'perplexity',
        embedding,
      });

      if (error) {
        console.error(`Failed to insert document for ${source.url}:`, error);
        continue;
      }

      newDocIds.push(docId);
    } catch (error) {
      console.error(`Failed to process source ${source.url}:`, error);
    }
  }

  // Generate similarity edges for new documents
  for (const docId of newDocIds) {
    try {
      await supabase.rpc('generate_similarity_edges', {
        doc_id: docId,
        debate_id: debateId,
        similarity_threshold: 0.7,
      });
    } catch (error) {
      console.error(`Failed to generate similarity edges for ${docId}:`, error);
    }
  }
}

/**
 * Build a unified context string from all research results.
 */
function buildCombinedContext(
  perplexity: {
    answer: string;
    sources: Array<{ url: string; title: string; snippet: string }>;
  },
  graphContext: GraphContext,
  similarDocs: SimilarDocumentRow[]
): string {
  const sections: string[] = [];

  // Perplexity research
  if (perplexity.answer) {
    sections.push('## Web Research (Perplexity)');
    sections.push(perplexity.answer);

    if (perplexity.sources.length > 0) {
      sections.push('\n### Sources');
      for (const source of perplexity.sources) {
        sections.push(`- [${source.title}](${source.url})`);
        if (source.snippet) {
          sections.push(`  > ${source.snippet}`);
        }
      }
    }
  }

  // Knowledge graph context
  if (graphContext.relevantNodes.length > 0) {
    sections.push('\n' + graphContext.contextSummary);
  }

  // Similar documents from vector search
  if (similarDocs.length > 0) {
    sections.push('\n## Similar Documents (Vector Search)');
    for (const doc of similarDocs) {
      const similarity = Math.round(doc.similarity * 100);
      sections.push(`- **${doc.title}** (${similarity}% match)`);
      if (doc.summary) {
        sections.push(`  ${doc.summary}`);
      }
    }
  }

  if (sections.length === 0) {
    return 'No research context available. Please rely on general knowledge.';
  }

  return sections.join('\n');
}
