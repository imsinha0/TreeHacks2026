'use client';

import React from 'react';
import { ExternalLink } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface CitationBadgeProps {
  citation: {
    label: string;
    source_url?: string;
  };
}

export default function CitationBadge({ citation }: CitationBadgeProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (citation.source_url) {
      window.open(citation.source_url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleClick}
            className="inline-flex items-center gap-1 rounded-md bg-blue-500/15 px-1.5 py-0.5 text-[11px] font-medium text-blue-400 border border-blue-500/25 hover:bg-blue-500/25 hover:border-blue-500/40 transition-colors cursor-pointer align-baseline mx-0.5"
          >
            <span className="max-w-[120px] truncate">{citation.label}</span>
            {citation.source_url && (
              <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-70" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-xs text-xs"
        >
          <p className="font-medium">{citation.label}</p>
          {citation.source_url && (
            <p className="mt-1 text-muted-foreground truncate">{citation.source_url}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
