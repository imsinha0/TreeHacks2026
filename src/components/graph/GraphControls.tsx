'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { NodeType } from '@/types/graph';
import { Search } from 'lucide-react';

interface GraphControlsProps {
  similarityThreshold: number;
  onThresholdChange: (value: number) => void;
  nodeTypeFilter: string[];
  onFilterChange: (types: string[]) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const ALL_NODE_TYPES: { value: NodeType; label: string }[] = [
  { value: 'document', label: 'Document' },
  { value: 'claim', label: 'Claim' },
  { value: 'entity', label: 'Entity' },
  { value: 'concept', label: 'Concept' },
  { value: 'evidence', label: 'Evidence' },
  { value: 'source', label: 'Source' },
];

const NODE_TYPE_DOT_COLORS: Record<NodeType, string> = {
  document: '#3B82F6',
  claim: '#8B5CF6',
  entity: '#22C55E',
  concept: '#F59E0B',
  evidence: '#06B6D4',
  source: '#F43F5E',
};

export default function GraphControls({
  similarityThreshold,
  onThresholdChange,
  nodeTypeFilter,
  onFilterChange,
  searchQuery,
  onSearchChange,
}: GraphControlsProps) {
  const handleTypeToggle = (nodeType: string) => {
    if (nodeTypeFilter.includes(nodeType)) {
      onFilterChange(nodeTypeFilter.filter((t) => t !== nodeType));
    } else {
      onFilterChange([...nodeTypeFilter, nodeType]);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border/50 bg-background/80 backdrop-blur-sm px-4 py-2.5">
      {/* Search input */}
      <div className="flex items-center gap-2 min-w-[180px]">
        <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <Input
          type="text"
          placeholder="Search nodes..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-7 text-xs border-none bg-transparent shadow-none focus-visible:ring-0 px-0"
        />
      </div>

      {/* Separator */}
      <div className="h-5 w-px bg-border/50" />

      {/* Similarity threshold slider */}
      <div className="flex items-center gap-2.5 min-w-[200px]">
        <Label className="text-xs text-muted-foreground whitespace-nowrap">
          Similarity
        </Label>
        <Slider
          value={[similarityThreshold]}
          onValueChange={([val]) => onThresholdChange(val)}
          min={0.5}
          max={1.0}
          step={0.05}
          className="w-24"
        />
        <span className="text-xs text-muted-foreground font-mono w-8">
          {similarityThreshold.toFixed(2)}
        </span>
      </div>

      {/* Separator */}
      <div className="h-5 w-px bg-border/50" />

      {/* Node type filter checkboxes */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <Label className="text-xs text-muted-foreground whitespace-nowrap">
          Types
        </Label>
        {ALL_NODE_TYPES.map(({ value, label }) => {
          const isActive = nodeTypeFilter.includes(value);
          return (
            <button
              key={value}
              onClick={() => handleTypeToggle(value)}
              className={`flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs transition-colors ${
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`}
            >
              <span
                className="inline-block h-2 w-2 rounded-full shrink-0"
                style={{
                  backgroundColor: NODE_TYPE_DOT_COLORS[value],
                  opacity: isActive ? 1 : 0.4,
                }}
              />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
