'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, XCircle, AlertTriangle, HelpCircle, ChevronDown, ChevronRight, Shield } from 'lucide-react';
import type { FactCheck, FactCheckVerdict } from '@/types/agent';

interface ClaimVerificationListProps {
  factChecks: FactCheck[];
}

const VERDICT_CONFIG: Record<FactCheckVerdict, {
  label: string;
  color: string;
  bgColor: string;
  icon: React.ElementType;
}> = {
  true: {
    label: 'True',
    color: 'text-green-700 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800',
    icon: CheckCircle,
  },
  mostly_true: {
    label: 'Mostly True',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    icon: CheckCircle,
  },
  mixed: {
    label: 'Mixed',
    color: 'text-yellow-700 dark:text-yellow-400',
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
    icon: AlertTriangle,
  },
  mostly_false: {
    label: 'Mostly False',
    color: 'text-orange-700 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
    icon: XCircle,
  },
  false: {
    label: 'False',
    color: 'text-red-700 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    icon: XCircle,
  },
  unverifiable: {
    label: 'Unverifiable',
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-700',
    icon: HelpCircle,
  },
};

function ClaimItem({ factCheck }: { factCheck: FactCheck }) {
  const [expanded, setExpanded] = useState(false);
  const config = VERDICT_CONFIG[factCheck.verdict];
  const VerdictIcon = config.icon;

  return (
    <div
      className={`rounded-lg border p-3 ${config.bgColor} cursor-pointer transition-colors hover:opacity-90`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start gap-3">
        <VerdictIcon className={`h-5 w-5 mt-0.5 shrink-0 ${config.color}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium leading-snug">
              {factCheck.claim_text}
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <Badge
                variant="outline"
                className={`text-[10px] ${config.color} border-current`}
              >
                {config.label}
              </Badge>
              {expanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>

          {/* Confidence indicator */}
          <div className="flex items-center gap-1 mt-1">
            <span className="text-xs text-muted-foreground">
              Confidence: {Math.round(factCheck.confidence * 100)}%
            </span>
            {factCheck.is_lie && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 ml-1">
                LIE DETECTED
              </Badge>
            )}
          </div>

          {/* Expanded content */}
          {expanded && (
            <div className="mt-3 space-y-2">
              <Separator />
              <p className="text-sm text-muted-foreground leading-relaxed">
                {factCheck.explanation}
              </p>
              {factCheck.sources && factCheck.sources.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground">Sources:</p>
                  {factCheck.sources.map((source, idx) => (
                    <a
                      key={idx}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-xs text-primary hover:underline truncate"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {source.title || source.url}
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ClaimVerificationList({ factChecks }: ClaimVerificationListProps) {
  // Group fact checks by agent_id
  const grouped = factChecks.reduce<Record<string, FactCheck[]>>((acc, fc) => {
    const key = fc.agent_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(fc);
    return acc;
  }, {});

  const agentIds = Object.keys(grouped);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="h-5 w-5 text-primary" />
          Claim Verification
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {agentIds.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No fact checks available.
          </p>
        )}

        {agentIds.map((agentId) => {
          const claims = grouped[agentId];
          return (
            <div key={agentId} className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground">
                Agent: {agentId}
              </h4>
              {claims.map((fc) => (
                <ClaimItem key={fc.id} factCheck={fc} />
              ))}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
