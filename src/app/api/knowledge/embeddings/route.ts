import { createServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const debateId = searchParams.get('debate_id');

    const supabase = createServerClient();

    // Query document_embeddings (id + embedding only) and join with documents for metadata
    // First get embeddings
    let embeddingQuery = supabase
      .from('document_embeddings')
      .select('id, embedding')
      .not('embedding', 'is', null);

    const { data: embeddingsData, error: embeddingsError } = await embeddingQuery;

    if (embeddingsError) {
      console.error('Error fetching embeddings:', embeddingsError);
      return NextResponse.json(
        { error: 'Failed to fetch embeddings' },
        { status: 500 }
      );
    }

    if (!embeddingsData || embeddingsData.length === 0) {
      console.log('[Embeddings API] No embeddings found in document_embeddings table');
      return NextResponse.json({ documents: [], message: 'No embeddings found' });
    }

    console.log(`[Embeddings API] Found ${embeddingsData.length} embeddings in document_embeddings table`);

    // Get document IDs
    const documentIds = embeddingsData.map((e) => e.id);

    // Fetch document metadata
    let documentsQuery = supabase
      .from('documents')
      .select('id, title, summary, source_url, source_type, created_at, debate_id')
      .in('id', documentIds);

    if (debateId) {
      documentsQuery = documentsQuery.eq('debate_id', debateId);
    }

    const { data: documentsData, error: documentsError } = await documentsQuery;

    if (documentsError) {
      console.error('Error fetching documents:', documentsError);
      return NextResponse.json(
        { error: 'Failed to fetch document metadata' },
        { status: 500 }
      );
    }

    // Create a map of document ID to metadata
    const documentsMap = new Map(
      (documentsData || []).map((doc: any) => [doc.id, doc])
    );

    console.log(`[Embeddings API] Found ${documentsData?.length || 0} matching documents in documents table`);

    // Combine embeddings with document metadata
    const documents = embeddingsData
      .map((emb: any) => {
        const docMeta = documentsMap.get(emb.id);
        if (!docMeta) {
          console.warn(`[Embeddings API] No document metadata found for embedding ID: ${emb.id}`);
          return null; // Skip if no matching document found
        }

        return {
          ...emb,
          ...docMeta,
        };
      })
      .filter((doc: any) => doc !== null);
    
    console.log(`[Embeddings API] Combined ${documents.length} documents with embeddings`);

    // Convert embeddings from PostgreSQL vector format to arrays
    // Supabase returns pgvector as a string like "[1,2,3,...]" or as an array
    const documentsWithEmbeddings = documents.map((doc: any) => {
      let embedding: number[] | null = null;

      // Extract embedding
      if (Array.isArray(doc.embedding)) {
        embedding = doc.embedding;
      } else if (typeof doc.embedding === 'string') {
        try {
          const cleaned = doc.embedding.trim();
          if (cleaned.startsWith('[') && cleaned.endsWith(']')) {
            embedding = JSON.parse(cleaned);
          } else {
            embedding = JSON.parse(doc.embedding);
          }
        } catch {
          const numbers = doc.embedding.match(/[\d.]+/g);
          if (numbers) {
            embedding = numbers.map(Number);
          }
        }
      }

      // Metadata is already merged from the join above
      return {
        id: doc.id,
        title: doc.title || 'Untitled',
        summary: doc.summary || '',
        source_url: doc.source_url || null,
        metadata: {
          source_type: doc.source_type || 'perplexity',
        },
        created_at: doc.created_at || new Date().toISOString(),
        embedding,
      };
    }).filter((doc) => {
      // Filter out documents without valid embeddings
      return doc.embedding !== null && 
             Array.isArray(doc.embedding) && 
             doc.embedding.length > 0 &&
             doc.embedding.length === 1536; // Ensure it's the expected dimension
    });

    console.log(`[Embeddings API] Returning ${documentsWithEmbeddings.length} documents with valid embeddings`);
    
    return NextResponse.json({
      documents: documentsWithEmbeddings,
      count: documentsWithEmbeddings.length,
    });
  } catch (error) {
    console.error('Error in embeddings API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

