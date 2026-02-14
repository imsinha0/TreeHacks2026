'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import CitationBadge from '@/components/debate/CitationBadge';
import type { DebateTurn } from '@/types/debate';

interface DebateTurnCardProps {
  turn: DebateTurn;
  agentName: string;
  agentRole: 'pro' | 'con';
  onCitationClick?: (nodeId: string) => void;
}

export default function DebateTurnCard({
  turn,
  agentName,
  agentRole,
  onCitationClick,
}: DebateTurnCardProps) {
  const isPro = agentRole === 'pro';
  const roleBadgeClasses = isPro
    ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    : 'bg-red-500/20 text-red-400 border-red-500/30';
  const turnAccentClasses = isPro
    ? 'border-l-blue-500/50'
    : 'border-l-red-500/50';

  const formattedTime = new Date(turn.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Render content with inline citation badges
  const renderContentWithCitations = () => {
    if (!turn.citations || turn.citations.length === 0) {
      return <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{turn.content}</p>;
    }

    // Build a map of citation labels to citation objects for quick lookup
    const citationMap = new Map(
      turn.citations.map((c) => [c.label, c])
    );

    // Split content by [citation_label] patterns
    const parts: React.ReactNode[] = [];
    const regex = /\[([^\]]+)\]/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(turn.content)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`}>
            {turn.content.slice(lastIndex, match.index)}
          </span>
        );
      }

      const label = match[1];
      const citation = citationMap.get(label);

      if (citation) {
        parts.push(
          <CitationBadge
            key={`cite-${match.index}`}
            citation={citation}
            onClick={onCitationClick}
          />
        );
      } else {
        // Not a known citation, render as-is
        parts.push(
          <span key={`bracket-${match.index}`}>[{label}]</span>
        );
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < turn.content.length) {
      parts.push(
        <span key={`text-${lastIndex}`}>{turn.content.slice(lastIndex)}</span>
      );
    }

    return (
      <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
        {parts}
      </p>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={`rounded-lg border border-border/50 bg-card/50 p-4 border-l-2 ${turnAccentClasses}`}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          {/* Turn number */}
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground shrink-0">
            {turn.turn_number}
          </span>

          {/* Agent name */}
          <span className="text-sm font-semibold">{agentName}</span>

          {/* Role badge */}
          <Badge variant="outline" className={`text-[10px] ${roleBadgeClasses}`}>
            {agentRole.toUpperCase()}
          </Badge>
        </div>

        {/* Timestamp */}
        <span className="text-[11px] text-muted-foreground shrink-0">
          {formattedTime}
        </span>
      </div>

      {/* Turn content with citations */}
      {renderContentWithCitations()}

      {/* Bottom citation list (quick reference) */}
      {turn.citations && turn.citations.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5 pt-2 border-t border-border/30">
          {turn.citations.map((citation) => (
            <CitationBadge
              key={citation.node_id}
              citation={citation}
              onClick={onCitationClick}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}
