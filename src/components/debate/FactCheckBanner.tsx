'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, ShieldCheck, ShieldAlert, AlertTriangle } from 'lucide-react';

interface FactCheckBannerProps {
  factCheck: {
    verdict: string;
    claim_text: string;
    explanation: string;
    confidence: number;
  };
}

const VERDICT_CONFIG: Record<string, {
  bg: string;
  border: string;
  text: string;
  badgeBg: string;
  icon: React.ElementType;
  label: string;
}> = {
  true: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    text: 'text-green-400',
    badgeBg: 'bg-green-500/20',
    icon: ShieldCheck,
    label: 'True',
  },
  mostly_true: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    text: 'text-green-400',
    badgeBg: 'bg-green-500/20',
    icon: ShieldCheck,
    label: 'Mostly True',
  },
  mixed: {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    text: 'text-yellow-400',
    badgeBg: 'bg-yellow-500/20',
    icon: AlertTriangle,
    label: 'Mixed',
  },
  mostly_false: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-400',
    badgeBg: 'bg-red-500/20',
    icon: ShieldAlert,
    label: 'Mostly False',
  },
  false: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-400',
    badgeBg: 'bg-red-500/20',
    icon: ShieldAlert,
    label: 'False',
  },
  unverifiable: {
    bg: 'bg-gray-500/10',
    border: 'border-gray-500/30',
    text: 'text-gray-400',
    badgeBg: 'bg-gray-500/20',
    icon: AlertTriangle,
    label: 'Unverifiable',
  },
};

export default function FactCheckBanner({ factCheck }: FactCheckBannerProps) {
  const [expanded, setExpanded] = useState(false);

  const config = VERDICT_CONFIG[factCheck.verdict] || VERDICT_CONFIG.unverifiable;
  const Icon = config.icon;
  const confidencePercent = Math.round(factCheck.confidence * 100);

  return (
    <div
      className={`rounded-lg border ${config.bg} ${config.border} px-3 py-2 my-1.5`}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left"
      >
        <Icon className={`h-3.5 w-3.5 shrink-0 ${config.text}`} />

        <Badge
          variant="outline"
          className={`text-[10px] shrink-0 ${config.badgeBg} ${config.text} border-transparent`}
        >
          {config.label}
        </Badge>

        <span className="text-[11px] text-muted-foreground font-mono shrink-0">
          {confidencePercent}%
        </span>

        <span className="text-xs text-muted-foreground truncate flex-1">
          {factCheck.claim_text}
        </span>

        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="mt-2 pl-5">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {factCheck.explanation}
          </p>
        </div>
      )}
    </div>
  );
}
