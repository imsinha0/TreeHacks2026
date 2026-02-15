'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, ZoomIn, RotateCcw, Info } from 'lucide-react';
// PCA is now computed server-side for better performance

// Dynamically import react-force-graph-3d to avoid SSR issues
const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), {
  ssr: false,
});

interface Document {
  id: string;
  title: string;
  summary: string;
  source_url: string | null;
  metadata: Record<string, unknown>;
  embedding: number[];
}

interface KnowledgeGraph3DProps {
  debateId?: string;
  autoLoad?: boolean;
}

export function KnowledgeGraph3D({ debateId, autoLoad = false }: KnowledgeGraph3DProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<any>(null);
  const [selectedNode, setSelectedNode] = useState<Document | null>(null);
  const fgRef = useRef<any>();

  const fetchDocuments = useCallback(async () => {
    console.log('[KnowledgeGraph] fetchDocuments called, debateId:', debateId);
    setLoading(true);
    setProcessing(false);
    setError(null);
    setGraphData(null); // Clear previous graph data

    try {
      const url = debateId
        ? `/api/knowledge/embeddings?debate_id=${debateId}`
        : '/api/knowledge/embeddings';
      
      console.log('[KnowledgeGraph] Fetching from:', url);
      const response = await fetch(url, {
        cache: 'no-store', // Force fresh fetch
      });
      
      console.log('[KnowledgeGraph] Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[KnowledgeGraph] Response error:', errorText);
        throw new Error(`Failed to fetch documents: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log(`[KnowledgeGraph] Fetched ${data.count || 0} documents`);
      console.log(`[KnowledgeGraph] Documents array length:`, data.documents?.length || 0);
      
      if (!data.documents || data.documents.length === 0) {
        console.warn('[KnowledgeGraph] No documents returned from API');
        setLoading(false);
        setProcessing(false);
        return;
      }

      setDocuments(data.documents);
      setLoading(false);
      setProcessing(true); // Show processing state during computation

      if (data.documents && data.documents.length > 0) {
        // Limit documents for performance (can be increased if needed)
        const MAX_DOCUMENTS = 200;
        const documentsToProcess = data.documents.slice(0, MAX_DOCUMENTS);
        
        if (data.documents.length > MAX_DOCUMENTS) {
          console.warn(`Processing ${MAX_DOCUMENTS} of ${data.documents.length} documents for performance`);
        }

        // Filter documents to only those with valid embeddings
        const validDocuments = documentsToProcess.filter(
          (doc: Document) => Array.isArray(doc.embedding) && doc.embedding.length === 1536
        );
        
        if (validDocuments.length === 0) {
          throw new Error('No documents with valid embeddings found');
        }

        if (validDocuments.length !== documentsToProcess.length) {
          console.warn(`Only ${validDocuments.length} of ${documentsToProcess.length} documents have valid embeddings`);
        }
        
        // Extract embeddings from valid documents
        const embeddings = validDocuments.map((doc: Document) => doc.embedding as number[]);
        
        // Perform PCA on server-side for better performance
        console.log(`[KnowledgeGraph] Computing PCA for ${embeddings.length} embeddings...`);
        const pcaResponse = await fetch('/api/knowledge/pca', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ embeddings }),
        });

        if (!pcaResponse.ok) {
          const errorData = await pcaResponse.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to compute PCA');
        }

        const pcaData = await pcaResponse.json();
        const normalized = pcaData.coordinates;
        
        if (!normalized || normalized.length !== embeddings.length) {
          throw new Error(`PCA returned ${normalized?.length || 0} coordinates but expected ${embeddings.length}`);
        }
        
        console.log(`[KnowledgeGraph] PCA complete in ${pcaData.processingTime}ms`);

        // Create graph data structure using valid documents
        const nodes = validDocuments.map((doc: Document, index: number) => ({
          id: doc.id,
          title: doc.title,
          summary: doc.summary,
          source_url: doc.source_url,
          metadata: doc.metadata,
          x: normalized[index][0],
          y: normalized[index][1],
          z: normalized[index][2],
          val: 5, // Node size
        }));

        // Optimized similarity calculation - only calculate top-k similar documents per node
        console.log('Calculating similarities...');
        const edges: Array<{ source: string; target: string; value: number }> = [];
        const similarityThreshold = 0.85;
        const MAX_CONNECTIONS_PER_NODE = 5; // Limit connections per node for performance

        // Use a more efficient approach: for each node, find top-k most similar
        for (let i = 0; i < nodes.length; i++) {
          const similarities: Array<{ index: number; similarity: number }> = [];
          
          for (let j = 0; j < nodes.length; j++) {
            if (i === j) continue;
            
            const similarity = cosineSimilarity(embeddings[i], embeddings[j]);
            if (similarity > similarityThreshold) {
              similarities.push({ index: j, similarity });
            }
          }
          
          // Sort by similarity and take top-k
          similarities.sort((a, b) => b.similarity - a.similarity);
          const topSimilar = similarities.slice(0, MAX_CONNECTIONS_PER_NODE);
          
          // Add edges (avoid duplicates by only adding when i < j)
          for (const { index: j, similarity } of topSimilar) {
            if (i < j) {
              edges.push({
                source: nodes[i].id,
                target: nodes[j].id,
                value: similarity,
              });
            }
          }
        }

        console.log(`[KnowledgeGraph] Graph ready: ${nodes.length} nodes, ${edges.length} edges`);
        console.log('[KnowledgeGraph] Setting graph data...');
        setGraphData({ nodes, links: edges });
        setProcessing(false);
        console.log('[KnowledgeGraph] Graph data set, processing complete');
      } else {
        console.warn('[KnowledgeGraph] No documents to process');
        setProcessing(false);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('[KnowledgeGraph] Error:', err);
      setError(errorMessage);
      setProcessing(false);
      setLoading(false);
    }
  }, [debateId]);

  // Only auto-fetch if autoLoad is true
  useEffect(() => {
    if (autoLoad) {
      fetchDocuments();
    }
  }, [fetchDocuments, autoLoad]);

  // Set initial camera position when graph data is ready
  useEffect(() => {
    if (graphData && graphData.nodes.length > 0 && fgRef.current) {
      // Set camera to a good viewing angle looking at the origin
      fgRef.current.cameraPosition({ x: 150, y: 150, z: 150 });
    }
  }, [graphData]);

  const handleNodeClick = useCallback((node: any) => {
    const doc = documents.find((d) => d.id === node.id);
    setSelectedNode(doc || null);
  }, [documents]);

  const handleBackgroundClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  if (loading || processing) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-[600px]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">
              {loading ? 'Loading documents...' : 'Processing embeddings and computing graph...'}
            </span>
            {processing && documents.length > 0 && (
              <span className="text-xs text-muted-foreground">
                Processing {documents.length} documents (this may take a moment)
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-[600px]">
          <div className="text-center">
            <p className="text-sm text-destructive mb-4">{error}</p>
            <Button onClick={fetchDocuments} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!graphData || graphData.nodes.length === 0) {
    console.log('[KnowledgeGraph] No graph data to render. graphData:', graphData, 'documents:', documents.length);
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-[600px]">
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-4">
            No documents with embeddings found.
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            Debug: Documents fetched: {documents.length} | Graph nodes: {graphData?.nodes?.length || 0}
          </p>
          <Button onClick={fetchDocuments} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </CardContent>
      </Card>
    );
  }

  console.log('[KnowledgeGraph] Rendering graph with', graphData.nodes.length, 'nodes and', graphData.links.length, 'edges');

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5 text-primary" />
                3D Knowledge Graph
              </CardTitle>
              <CardDescription>
                PCA visualization of {graphData.nodes.length} documents
                {graphData.links.length > 0 && ` with ${graphData.links.length} similarity connections`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fgRef.current?.zoomToFit(400)}
              >
                <ZoomIn className="h-4 w-4 mr-1" />
                Fit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  fgRef.current?.cameraPosition({ x: 0, y: 0, z: 200 });
                  fgRef.current?.zoom(1);
                }}
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset
              </Button>
              <Button variant="outline" size="sm" onClick={fetchDocuments}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative h-[600px] rounded-lg border bg-background overflow-hidden">
            {typeof window !== 'undefined' && (
              <ForceGraph3D
                ref={fgRef}
                graphData={graphData}
                nodeLabel={(node: any) => node.title || 'Document'}
                nodeColor={(node: any) => {
                  // Color by source type or use default
                  const sourceType = node.metadata?.source_type || 'web';
                  const colors: Record<string, string> = {
                    perplexity: '#3b82f6',
                    graph_discovery: '#8b5cf6',
                    upload: '#10b981',
                    web: '#f59e0b',
                  };
                  return colors[sourceType] || '#6b7280';
                }}
                nodeOpacity={0.9}
                linkColor={() => 'rgba(255, 255, 255, 0.2)'}
                linkWidth={(link: any) => link.value * 2}
                linkOpacity={0.4}
                onNodeClick={handleNodeClick}
                onBackgroundClick={handleBackgroundClick}
                showNavInfo={false}
                enableNodeDrag={true}
                cooldownTicks={100}
                onEngineStop={() => {
                  // Set a good default camera position looking at the origin from an angle
                  fgRef.current?.cameraPosition({ x: 150, y: 150, z: 150 });
                  fgRef.current?.zoomToFit(400);
                }}
              />
            )}
          </div>

          {/* Legend */}
          <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="font-medium">Source Types:</span>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span>Perplexity</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-purple-500" />
              <span>Graph Discovery</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span>Upload</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span>Web</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Node Details Panel */}
      {selectedNode && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{selectedNode.title}</CardTitle>
            {selectedNode.source_url && (
              <CardDescription>
                <a
                  href={selectedNode.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {selectedNode.source_url}
                </a>
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {selectedNode.summary && (
              <p className="text-sm text-muted-foreground mb-4">
                {selectedNode.summary}
              </p>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedNode(null)}
            >
              Close
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) {
    return 0;
  }

  return dotProduct / denominator;
}

