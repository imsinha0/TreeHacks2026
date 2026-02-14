'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookOpen, ExternalLink, ArrowUpDown } from 'lucide-react';
import type { SourceUsed } from '@/types/debate';

interface SourceMapProps {
  sources: SourceUsed[];
}

type SortField = 'reliability' | 'title';
type SortDirection = 'asc' | 'desc';

function getReliabilityColor(reliability: number): string {
  if (reliability >= 0.8) return 'text-green-600 dark:text-green-400';
  if (reliability >= 0.6) return 'text-yellow-600 dark:text-yellow-400';
  if (reliability >= 0.4) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
}

function getReliabilityBg(reliability: number): string {
  if (reliability >= 0.8) return 'bg-green-100 dark:bg-green-900/30';
  if (reliability >= 0.6) return 'bg-yellow-100 dark:bg-yellow-900/30';
  if (reliability >= 0.4) return 'bg-orange-100 dark:bg-orange-900/30';
  return 'bg-red-100 dark:bg-red-900/30';
}

export function SourceMap({ sources }: SourceMapProps) {
  const [sortField, setSortField] = useState<SortField>('reliability');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedSources = [...sources].sort((a, b) => {
    const multiplier = sortDirection === 'asc' ? 1 : -1;
    if (sortField === 'reliability') {
      return (a.reliability - b.reliability) * multiplier;
    }
    return a.title.localeCompare(b.title) * multiplier;
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="h-5 w-5 text-primary" />
            Sources Used
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant={sortField === 'reliability' ? 'secondary' : 'ghost'}
              size="sm"
              className="text-xs h-7"
              onClick={() => toggleSort('reliability')}
            >
              <ArrowUpDown className="h-3 w-3 mr-1" />
              Reliability
            </Button>
            <Button
              variant={sortField === 'title' ? 'secondary' : 'ghost'}
              size="sm"
              className="text-xs h-7"
              onClick={() => toggleSort('title')}
            >
              <ArrowUpDown className="h-3 w-3 mr-1" />
              Title
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {sortedSources.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No sources available.
          </p>
        ) : (
          <div className="space-y-3">
            {sortedSources.map((source, idx) => (
              <div
                key={`${source.url}-${idx}`}
                className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                {/* Reliability score badge */}
                <div
                  className={`shrink-0 flex items-center justify-center h-10 w-10 rounded-lg text-sm font-bold ${getReliabilityBg(source.reliability)} ${getReliabilityColor(source.reliability)}`}
                >
                  {Math.round(source.reliability * 100)}
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">
                      {source.title || 'Untitled Source'}
                    </p>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-primary hover:text-primary/80"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>

                  <p className="text-xs text-muted-foreground truncate">
                    {source.url}
                  </p>

                  {source.cited_by && source.cited_by.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-xs text-muted-foreground">Cited by:</span>
                      {source.cited_by.map((citer) => (
                        <Badge
                          key={citer}
                          variant="outline"
                          className="text-[10px] px-1.5 py-0"
                        >
                          {citer}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
