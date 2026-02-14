'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import KnowledgeGraph2D from '@/components/graph/KnowledgeGraph2D';
import NodeDetailPanel from '@/components/graph/NodeDetailPanel';
import GraphControls from '@/components/graph/GraphControls';
import GraphLegend from '@/components/graph/GraphLegend';
import GraphHighlighter from '@/components/graph/GraphHighlighter';

export default function FullScreenGraphPage() {
  const params = useParams();
  const debateId = params.id as string;

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  const [similarityThreshold, setSimilarityThreshold] = useState(0.7);
  const [nodeTypeFilter, setNodeTypeFilter] = useState<string[]>([
    'document', 'claim', 'entity', 'concept', 'evidence', 'source',
  ]);
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="h-[calc(100vh-3.5rem)] relative">
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        <Link href={`/debate/${debateId}`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Debate
          </Button>
        </Link>
        <div className="flex items-center gap-1 text-xs text-muted-foreground bg-background/80 backdrop-blur px-2 py-1 rounded">
          <Maximize2 className="h-3 w-3" />
          Full Screen Graph
        </div>
      </div>

      <div className="absolute top-4 right-4 z-10 w-96">
        <GraphControls
          similarityThreshold={similarityThreshold}
          onThresholdChange={setSimilarityThreshold}
          nodeTypeFilter={nodeTypeFilter}
          onFilterChange={setNodeTypeFilter}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </div>

      <div className="absolute bottom-4 left-4 z-10">
        <GraphLegend />
      </div>

      <KnowledgeGraph2D
        debateId={debateId}
        onNodeClick={setSelectedNodeId}
        highlightedNodeId={highlightedNodeId}
      />

      <GraphHighlighter
        debateId={debateId}
        onHighlight={setHighlightedNodeId}
        onClearHighlight={() => setHighlightedNodeId(null)}
      />

      {selectedNodeId && (
        <div className="absolute top-20 right-4 z-10 w-96">
          <NodeDetailPanel
            nodeId={selectedNodeId}
            debateId={debateId}
            onClose={() => setSelectedNodeId(null)}
          />
        </div>
      )}
    </div>
  );
}
