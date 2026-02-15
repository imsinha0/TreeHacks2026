import { SupabaseClient } from '@supabase/supabase-js';
import { PerplexityClient } from './perplexity';
import { generateEmbeddingsBatch } from '@/lib/utils/embeddings';

export interface ResearchResults {
  perplexityAnswer: string;
  sources: Array<{ url: string; title: string; snippet: string }>;
  combinedContext: string;
}

/**
 * Conduct research using Perplexity web search.
 * Perplexity sources are persisted as documents for citation during the debate.
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

  const t0 = Date.now();
  console.log(`[Research ${role}] Calling Perplexity (depth: ${researchDepth})...`);

  const perplexityResult = await runPerplexitySearch(perplexityApiKey, searchQuery, researchDepth);

  console.log(`[Research ${role}] Perplexity done: ${perplexityResult.sources.length} sources (${Date.now() - t0}ms)`);

  // Persist Perplexity sources as documents AND generate embeddings
  if (perplexityResult.sources.length > 0) {
    const tPersist = Date.now();
    await persistSourceDocuments({
      sources: perplexityResult.sources,
      debateId,
      supabase,
    });
    
    // Generate and store embeddings in optimized table
    await persistDocumentEmbeddings({
      sources: perplexityResult.sources,
      debateId,
      supabase,
      openaiApiKey,
    });
    
    console.log(`[Research ${role}] Sources and embeddings persisted (${Date.now() - tPersist}ms)`);
  }

  const combinedContext = buildCombinedContext(perplexityResult);

  return {
    perplexityAnswer: perplexityResult.answer,
    sources: perplexityResult.sources,
    combinedContext,
  };
}

/**
 * Persist Perplexity sources as documents for citation.
 */
async function persistSourceDocuments(params: {
  sources: Array<{ url: string; title: string; snippet: string }>;
  debateId: string;
  supabase: SupabaseClient;
}): Promise<void> {
  const { sources, debateId, supabase } = params;

  try {
    const docRows = sources.map((src) => ({
      debate_id: debateId,
      title: src.title || 'Untitled Source',
      summary: src.snippet || '',
      content: src.snippet || '',
      source_url: src.url || null,
      source_type: 'perplexity' as const,
    }));

    const { error: insertError } = await supabase
      .from('documents')
      .insert(docRows);

    if (insertError) {
      console.error('Failed to insert documents:', insertError);
    }
  } catch (err) {
    console.error('persistSourceDocuments failed (non-fatal):', err);
  }
}

/**
 * Generate embeddings and persist them in the optimized document_embeddings table.
 * This table only stores document ID and embedding for maximum performance.
 * We need to get the document IDs from the documents table first.
 */
async function persistDocumentEmbeddings(params: {
  sources: Array<{ url: string; title: string; snippet: string }>;
  debateId: string;
  supabase: SupabaseClient;
  openaiApiKey: string;
}): Promise<void> {
  const { sources, debateId, supabase, openaiApiKey } = params;

  if (!openaiApiKey) {
    console.warn('OpenAI API key not provided, skipping embedding generation');
    return;
  }

  try {
    // First, get the document IDs that were just inserted
    // We'll match by title and source_url to find the corresponding documents
    const documentIds: string[] = [];
    
    for (const src of sources) {
      const { data: docData } = await supabase
        .from('documents')
        .select('id')
        .eq('debate_id', debateId)
        .eq('title', src.title || 'Untitled Source')
        .eq('source_url', src.url || null)
        .limit(1)
        .single();
      
      if (docData?.id) {
        documentIds.push(docData.id);
      }
    }

    if (documentIds.length === 0) {
      console.warn('No document IDs found, skipping embedding storage');
      return;
    }

    // Prepare texts for embedding (combine title + snippet for better semantic representation)
    const textsToEmbed = sources.map((src) => {
      const title = src.title || 'Untitled Source';
      const snippet = src.snippet || '';
      return `${title}. ${snippet}`.trim();
    });

    // Generate embeddings in batch
    console.log(`[Embeddings] Generating embeddings for ${textsToEmbed.length} documents...`);
    const embeddings = await generateEmbeddingsBatch(textsToEmbed, openaiApiKey, 10);
    console.log(`[Embeddings] Generated ${embeddings.length} embeddings`);

    // Prepare rows for insertion - only id and embedding
    const embeddingRows = documentIds.map((docId, index) => ({
      id: docId, // Use the document ID from documents table
      embedding: embeddings[index],
    }));

    // Insert into optimized embeddings table (only id + embedding)
    const { error: insertError } = await supabase
      .from('document_embeddings')
      .insert(embeddingRows);

    if (insertError) {
      console.error('Failed to insert document embeddings:', insertError);
    } else {
      console.log(`[Embeddings] Successfully stored ${embeddingRows.length} embeddings`);
    }
  } catch (err) {
    console.error('persistDocumentEmbeddings failed (non-fatal):', err);
  }
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
 * Build a unified context string from research results.
 */
function buildCombinedContext(
  perplexity: {
    answer: string;
    sources: Array<{ url: string; title: string; snippet: string }>;
  }
): string {
  const sections: string[] = [];

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

  if (sections.length === 0) {
    return 'No research context available. Please rely on general knowledge.';
  }

  return sections.join('\n');
}
