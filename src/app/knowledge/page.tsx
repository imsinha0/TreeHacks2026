'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { KnowledgeGraph3D } from '@/components/knowledge/KnowledgeGraph3D';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Network, Database, Loader2, TestTube } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function KnowledgePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const [debateId, setDebateId] = useState<string>('');
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [loadingTest, setLoadingTest] = useState(false);
  const [showGraph, setShowGraph] = useState(false);
  const [graphKey, setGraphKey] = useState(0);

  useEffect(() => {
    const debateIdParam = searchParams.get('debate_id');
    if (debateIdParam) {
      setDebateId(debateIdParam);
    }
  }, [searchParams]);

  const handleLoadDemoData = async () => {
    setLoadingDemo(true);
    try {
      const openaiKey = prompt('Enter your OpenAI API key to generate demo embeddings:');
      if (!openaiKey) {
        setLoadingDemo(false);
        return;
      }

      const response = await fetch('/api/knowledge/demo-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openaiApiKey: openaiKey }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load demo data');
      }

      toast({
        title: 'Demo data loaded',
        description: `Successfully inserted ${data.count} demo document embeddings. Refresh to see them in the graph.`,
      });

      // Refresh the page to show new data
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load demo data',
        variant: 'destructive',
      });
    } finally {
      setLoadingDemo(false);
    }
  };

  const handleLoadTestData = async () => {
    console.log('[KnowledgePage] Generate Test Data button clicked');
    setLoadingTest(true);
    
    try {
      console.log('[KnowledgePage] Calling /api/knowledge/test-embeddings...');
      const response = await fetch('/api/knowledge/test-embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 15 }),
      });

      console.log('[KnowledgePage] Response status:', response.status, response.statusText);

      const data = await response.json();
      console.log('[KnowledgePage] Response data:', data);

      if (!response.ok) {
        console.error('[KnowledgePage] Error response:', data);
        throw new Error(data.error || 'Failed to load test data');
      }

      console.log(`[KnowledgePage] Successfully created ${data.count} test documents`);
      
      toast({
        title: 'Test data loaded',
        description: `Successfully created ${data.count} test documents with fake embeddings.`,
      });

      // Don't auto-reload - let user click "Generate Visualization"
      console.log('[KnowledgePage] Test data created. User can now click "Generate Visualization"');
      setShowGraph(false); // Reset graph so user can regenerate
    } catch (error) {
      console.error('[KnowledgePage] Error loading test data:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load test data',
        variant: 'destructive',
      });
      setLoadingTest(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Network className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Knowledge Visualization</h1>
        </div>
        <p className="text-muted-foreground">
          Explore the semantic relationships between legislation documents using 3D PCA visualization.
          Documents with similar content cluster together in the 3D space.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filter by Debate</CardTitle>
            <CardDescription>
              Optionally filter documents by a specific debate ID, or leave empty to view all documents.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-2">
                <Label htmlFor="debate-id">Debate ID (optional)</Label>
                <Input
                  id="debate-id"
                  placeholder="Enter debate ID or leave empty for all documents"
                  value={debateId}
                  onChange={(e) => setDebateId(e.target.value)}
                />
              </div>
              <Button
                onClick={() => {
                  if (debateId) {
                    router.push(`/knowledge?debate_id=${debateId}`);
                  } else {
                    router.push('/knowledge');
                  }
                }}
              >
                Apply Filter
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Demo Data
            </CardTitle>
            <CardDescription>
              Load pre-generated demo documents about abortion debate for fast visualization testing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleLoadDemoData}
              disabled={loadingDemo}
              variant="outline"
              className="w-full"
            >
              {loadingDemo ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Database className="mr-2 h-4 w-4" />
                  Load Demo Data
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TestTube className="h-5 w-5 text-primary" />
              Test Data (Fake Embeddings)
            </CardTitle>
            <CardDescription>
              Generate test documents with random fake embeddings to quickly test the visualization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleLoadTestData}
              disabled={loadingTest}
              variant="outline"
              className="w-full"
            >
              {loadingTest ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <TestTube className="mr-2 h-4 w-4" />
                  Generate Test Data
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {showGraph && (
        <KnowledgeGraph3D 
          debateId={debateId || undefined} 
          autoLoad={true}
          key={graphKey} // Force re-render when key changes
        />
      )}

      {!showGraph && (
        <Card>
          <CardContent className="flex items-center justify-center h-[600px]">
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                Click "Generate Visualization" below to load and visualize documents
              </p>
              <Button onClick={() => {
                console.log('[KnowledgePage] Generate Visualization clicked');
                setGraphKey(prev => prev + 1);
                setShowGraph(true);
              }} size="lg">
                <Network className="mr-2 h-5 w-5" />
                Generate Visualization
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

