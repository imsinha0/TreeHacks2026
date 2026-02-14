'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { FileText, Trophy } from 'lucide-react';
import type { DebateSummary } from '@/types/debate';

interface ModeratorSummaryProps {
  summary: DebateSummary;
}

export function ModeratorSummary({ summary }: ModeratorSummaryProps) {
  return (
    <div className="space-y-6">
      {/* Overall Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-primary" />
            Overall Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
            {summary.overall_summary}
          </p>
        </CardContent>
      </Card>

      {/* Winner Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Winner Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
            {summary.winner_analysis}
          </p>
          {summary.recommendations && (
            <>
              <Separator className="my-4" />
              <div>
                <h4 className="text-sm font-semibold mb-2">Recommendations</h4>
                <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                  {summary.recommendations}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
