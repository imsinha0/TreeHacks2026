import { NextResponse } from 'next/server';
import { performPCA, normalize3D } from '@/lib/utils/pca';
import { performFastPCACentered } from '@/lib/utils/pca-fast';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { embeddings } = body;

    if (!embeddings || !Array.isArray(embeddings) || embeddings.length === 0) {
      return NextResponse.json(
        { error: 'Embeddings array is required' },
        { status: 400 }
      );
    }

    // Limit to prevent server overload
    const MAX_EMBEDDINGS = 500;
    const embeddingsToProcess = embeddings.slice(0, MAX_EMBEDDINGS);

    if (embeddings.length > MAX_EMBEDDINGS) {
      console.warn(`Processing ${MAX_EMBEDDINGS} of ${embeddings.length} embeddings`);
    }

    console.log(`[PCA] Computing PCA for ${embeddingsToProcess.length} embeddings...`);
    const startTime = Date.now();

    // Always use fast approximation - full PCA is too slow even for small datasets
    // Fast PCA is O(n) vs O(n*d²) for full PCA, and gives good enough results for visualization
    console.log('[PCA] Using fast approximation (full PCA is too slow)');
    const pcaResult = performFastPCACentered(embeddingsToProcess, 3);
    
    // Normalize coordinates
    const normalized = normalize3D(pcaResult, 100);

    const duration = Date.now() - startTime;
    console.log(`[PCA] Completed in ${duration}ms`);

    return NextResponse.json({
      coordinates: normalized,
      count: normalized.length,
      processingTime: duration,
    });
  } catch (error) {
    console.error('Error in PCA API:', error);
    return NextResponse.json(
      { error: 'Failed to compute PCA', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

