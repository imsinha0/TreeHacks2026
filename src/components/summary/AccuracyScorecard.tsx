'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Target } from 'lucide-react';
import type { DebateAgent } from '@/types/agent';

interface AccuracyScorecardProps {
  accuracyScores: Record<string, number>;
  agents: DebateAgent[];
}

export function AccuracyScorecard({ accuracyScores, agents }: AccuracyScorecardProps) {
  // Build a list matching agent info with their accuracy score
  const agentScores = agents
    .filter((agent) => agent.role === 'pro' || agent.role === 'con')
    .map((agent) => {
      // Try matching by agent id or agent name as keys
      const score =
        accuracyScores[agent.id] ??
        accuracyScores[agent.name] ??
        accuracyScores[agent.role] ??
        null;

      return {
        agent,
        score: score !== null ? Math.round(score * 100) / 100 : null,
      };
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Target className="h-5 w-5 text-primary" />
          Accuracy Scorecard
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {agentScores.map(({ agent, score }) => {
          const isPro = agent.role === 'pro';
          const percentage = score !== null ? score : 0;

          return (
            <div key={agent.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`h-3 w-3 rounded-full ${
                      isPro ? 'bg-blue-500' : 'bg-red-500'
                    }`}
                  />
                  <span className="text-sm font-medium">{agent.name}</span>
                  <span
                    className={`text-xs font-semibold uppercase ${
                      isPro ? 'text-blue-500' : 'text-red-500'
                    }`}
                  >
                    ({agent.role})
                  </span>
                </div>
                <span className="text-sm font-semibold">
                  {score !== null ? `${percentage}%` : 'N/A'}
                </span>
              </div>
              <div className="relative">
                <Progress
                  value={percentage}
                  className={`h-3 ${isPro ? '[&>div]:bg-blue-500' : '[&>div]:bg-red-500'}`}
                />
              </div>
            </div>
          );
        })}

        {agentScores.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No accuracy scores available.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
