'use client';

import React from 'react';
import { NodeType } from '@/types/graph';

const NODE_TYPE_LEGEND: { type: NodeType; label: string; color: string }[] = [
  { type: 'document', label: 'Document', color: '#3B82F6' },
  { type: 'claim', label: 'Claim', color: '#8B5CF6' },
  { type: 'entity', label: 'Entity', color: '#22C55E' },
  { type: 'concept', label: 'Concept', color: '#F59E0B' },
  { type: 'evidence', label: 'Evidence', color: '#06B6D4' },
  { type: 'source', label: 'Source', color: '#F43F5E' },
];

export default function GraphLegend() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/80 backdrop-blur-sm px-3 py-1.5">
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
        Legend
      </span>
      {NODE_TYPE_LEGEND.map(({ type, label, color }) => (
        <div key={type} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: color }}
          />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
      ))}
    </div>
  );
}
