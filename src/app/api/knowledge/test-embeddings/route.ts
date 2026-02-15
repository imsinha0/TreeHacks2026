import { createServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * Generate fake embeddings for testing
 * Creates random 1536-dimensional vectors
 */
function generateFakeEmbedding(): number[] {
  const embedding: number[] = [];
  for (let i = 0; i < 1536; i++) {
    // Generate random values between -1 and 1
    embedding.push(Math.random() * 2 - 1);
  }
  // Normalize to unit vector (optional, but makes similarity calculations more meaningful)
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => val / magnitude);
}

/**
 * Generate test documents with fake embeddings
 */
const TEST_DOCUMENTS = [
  { title: 'Test Document 1', summary: 'This is a test document about artificial intelligence and machine learning.', source_url: 'https://example.com/test1' },
  { title: 'Test Document 2', summary: 'This document discusses climate change and environmental policy.', source_url: 'https://example.com/test2' },
  { title: 'Test Document 3', summary: 'A document about healthcare reform and medical innovation.', source_url: 'https://example.com/test3' },
  { title: 'Test Document 4', summary: 'Information about space exploration and NASA missions.', source_url: 'https://example.com/test4' },
  { title: 'Test Document 5', summary: 'Content related to renewable energy and solar power.', source_url: 'https://example.com/test5' },
  { title: 'Test Document 6', summary: 'Document about education reform and online learning.', source_url: 'https://example.com/test6' },
  { title: 'Test Document 7', summary: 'Information on cybersecurity and data protection.', source_url: 'https://example.com/test7' },
  { title: 'Test Document 8', summary: 'Content about urban planning and smart cities.', source_url: 'https://example.com/test8' },
  { title: 'Test Document 9', summary: 'Document discussing biotechnology and genetic engineering.', source_url: 'https://example.com/test9' },
  { title: 'Test Document 10', summary: 'Information about quantum computing and quantum physics.', source_url: 'https://example.com/test10' },
  { title: 'Test Document 11', summary: 'Content on social media and digital communication.', source_url: 'https://example.com/test11' },
  { title: 'Test Document 12', summary: 'Document about transportation and electric vehicles.', source_url: 'https://example.com/test12' },
  { title: 'Test Document 13', summary: 'Information about agriculture and sustainable farming.', source_url: 'https://example.com/test13' },
  { title: 'Test Document 14', summary: 'Content on financial technology and cryptocurrency.', source_url: 'https://example.com/test14' },
  { title: 'Test Document 15', summary: 'Document about mental health and wellness programs.', source_url: 'https://example.com/test15' },
];

export async function POST(request: Request) {
  console.log('[Test Embeddings API] POST request received');
  try {
    const body = await request.json();
    const { count = 15 } = body; // Default to 15 test documents
    console.log(`[Test Embeddings API] Request body:`, body, `count: ${count}`);

    const supabase = createServerClient();
    console.log('[Test Embeddings API] Supabase client created');

    // Create a dummy debate for test documents (required by schema - debate_id is NOT NULL)
    console.log('[Test Embeddings API] Creating/finding dummy debate for test documents...');
    const { data: testDebate, error: debateError } = await supabase
      .from('debates')
      .insert({
        topic: 'Test Data Visualization',
        description: 'Dummy debate for test document embeddings',
        status: 'completed',
      })
      .select('id')
      .single();

    let debateId: string;
    if (debateError || !testDebate) {
      // Try to find an existing test debate instead
      console.log('[Test Embeddings API] Failed to create debate, trying to find existing...');
      const { data: existingDebate } = await supabase
        .from('debates')
        .select('id')
        .eq('topic', 'Test Data Visualization')
        .limit(1)
        .single();

      if (!existingDebate) {
        console.error('[Test Embeddings API] Could not create or find test debate:', debateError);
        return NextResponse.json(
          { error: 'Failed to create or find test debate', details: debateError?.message },
          { status: 500 }
        );
      }

      debateId = existingDebate.id;
      console.log('[Test Embeddings API] Using existing test debate:', debateId);
    } else {
      debateId = testDebate.id;
      console.log('[Test Embeddings API] Created test debate:', debateId);
    }

    // Generate test documents
    const documentsToCreate = TEST_DOCUMENTS.slice(0, Math.min(count, TEST_DOCUMENTS.length));
    
    console.log(`[Test Embeddings] Creating ${documentsToCreate.length} test documents...`);

    // Insert documents into documents table
    const docRows = documentsToCreate.map((doc) => ({
      debate_id: debateId, // Use the test debate ID
      title: doc.title,
      summary: doc.summary,
      content: doc.summary,
      source_url: doc.source_url,
      source_type: 'web' as const,
    }));

    console.log(`[Test Embeddings API] Inserting ${docRows.length} documents into documents table...`);
    const { data: insertedDocs, error: docInsertError } = await supabase
      .from('documents')
      .insert(docRows)
      .select('id');

    if (docInsertError) {
      console.error('[Test Embeddings API] Error inserting documents:', docInsertError);
      return NextResponse.json(
        { error: 'Failed to insert test documents', details: docInsertError.message },
        { status: 500 }
      );
    }

    if (!insertedDocs || insertedDocs.length === 0) {
      console.error('[Test Embeddings API] No documents were inserted');
      return NextResponse.json(
        { error: 'No documents were inserted' },
        { status: 500 }
      );
    }

    console.log(`[Test Embeddings API] Successfully inserted ${insertedDocs.length} documents:`, insertedDocs.map((d: any) => d.id));

    console.log(`[Test Embeddings] Inserted ${insertedDocs.length} documents, generating fake embeddings...`);

    // Generate fake embeddings for each document
    const embeddingRows = insertedDocs.map((doc: any) => ({
      id: doc.id,
      embedding: generateFakeEmbedding(),
    }));

    // Insert embeddings into document_embeddings table
    console.log(`[Test Embeddings API] Inserting ${embeddingRows.length} embeddings into document_embeddings table...`);
    const { error: embeddingInsertError } = await supabase
      .from('document_embeddings')
      .insert(embeddingRows);

    if (embeddingInsertError) {
      console.error('[Test Embeddings API] Error inserting embeddings:', embeddingInsertError);
      return NextResponse.json(
        { error: 'Failed to insert test embeddings', details: embeddingInsertError.message },
        { status: 500 }
      );
    }

    console.log(`[Test Embeddings API] Successfully created ${embeddingRows.length} test documents with embeddings`);

    return NextResponse.json({
      success: true,
      count: embeddingRows.length,
      message: `Successfully created ${embeddingRows.length} test documents with fake embeddings`,
      documentIds: insertedDocs.map((d: any) => d.id),
    });
  } catch (error) {
    console.error('Error in test embeddings API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

