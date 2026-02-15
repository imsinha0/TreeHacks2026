'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ModeratorSummary } from '@/components/summary/ModeratorSummary';
import { AccuracyScorecard } from '@/components/summary/AccuracyScorecard';
import { ClaimVerificationList } from '@/components/summary/ClaimVerificationList';
import { SourceMap } from '@/components/summary/SourceMap';
import { generateDebatePDF } from '@/lib/export/pdf-export';
import { generateDebateMarkdown } from '@/lib/export/markdown-export';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  Download,
  FileText,
  Loader2,
  AlertCircle,
  Swords,
  BarChart3,
  Network,
} from 'lucide-react';
import type { Debate, DebateSummary, KeyArgument } from '@/types/debate';
import type { DebateAgent, FactCheck } from '@/types/agent';

// ---------------------------------------------------------------------------
// Key Arguments section
// ---------------------------------------------------------------------------

function KeyArgumentsList({ args }: { args: KeyArgument[] }) {
  if (args.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Swords className="h-5 w-5 text-primary" />
          Key Arguments
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {args.map((arg, idx) => {
          const isPro = arg.agent_role === 'pro';
          return (
            <div
              key={idx}
              className={`p-4 rounded-lg border-l-4 ${
                isPro
                  ? 'border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
                  : 'border-l-red-500 bg-red-50/50 dark:bg-red-950/20'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Badge
                  variant={isPro ? 'default' : 'destructive'}
                  className="text-[10px] px-1.5 py-0"
                >
                  {arg.agent_role.toUpperCase()}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Strength: {arg.strength}/10
                </span>
              </div>
              <p className="text-sm leading-relaxed">{arg.argument}</p>
              {arg.supported_by.length > 0 && (
                <div className="flex items-center gap-1 mt-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">
                    Supported by:
                  </span>
                  {arg.supported_by.map((s) => (
                    <Badge
                      key={s}
                      variant="outline"
                      className="text-[10px] px-1.5 py-0"
                    >
                      {s}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Vote Results section
// ---------------------------------------------------------------------------

function VoteResultsSection({
  voteResults,
}: {
  voteResults: NonNullable<DebateSummary['vote_results']>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <BarChart3 className="h-5 w-5 text-primary" />
          Vote Results
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Vote bar */}
        <div className="flex h-8 rounded-lg overflow-hidden">
          {voteResults.pro_percentage > 0 && (
            <div
              className="bg-blue-500 flex items-center justify-center text-white text-xs font-semibold transition-all"
              style={{ width: `${voteResults.pro_percentage}%` }}
            >
              {voteResults.pro_percentage >= 10 &&
                `${Math.round(voteResults.pro_percentage)}%`}
            </div>
          )}
          {voteResults.con_percentage > 0 && (
            <div
              className="bg-red-500 flex items-center justify-center text-white text-xs font-semibold transition-all"
              style={{ width: `${voteResults.con_percentage}%` }}
            >
              {voteResults.con_percentage >= 10 &&
                `${Math.round(voteResults.con_percentage)}%`}
            </div>
          )}
        </div>

        {/* Vote counts */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-blue-500" />
            <span className="font-medium">PRO</span>
            <span className="text-muted-foreground">
              {voteResults.pro_count} votes
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">
              {voteResults.con_count} votes
            </span>
            <span className="font-medium">CON</span>
            <div className="h-3 w-3 rounded-full bg-red-500" />
          </div>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          Total votes: {voteResults.total}
        </p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main summary page
// ---------------------------------------------------------------------------

export default function SummaryPage() {
  const params = useParams<{ id: string }>();
  const debateId = params.id;

  const [debate, setDebate] = useState<Debate | null>(null);
  const [summary, setSummary] = useState<DebateSummary | null>(null);
  const [agents, setAgents] = useState<DebateAgent[]>([]);
  const [factChecks, setFactChecks] = useState<FactCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [exportingMD, setExportingMD] = useState(false);

  // -------------------------------------------------------------------------
  // Fetch all data
  // -------------------------------------------------------------------------

  const fetchData = useCallback(async () => {
    if (!debateId) return;
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // Fetch debate
      const { data: debateData, error: debateError } = await supabase
        .from('debates')
        .select('*')
        .eq('id', debateId)
        .single();

      if (debateError || !debateData) {
        setError('Debate not found.');
        setLoading(false);
        return;
      }

      setDebate(debateData as Debate);

      // Fetch summary
      const { data: summaryData } = await supabase
        .from('debate_summaries')
        .select('*')
        .eq('debate_id', debateId)
        .single();

      if (summaryData) {
        setSummary(summaryData as DebateSummary);
      }

      // Fetch agents
      const { data: agentsData } = await supabase
        .from('debate_agents')
        .select('*')
        .eq('debate_id', debateId);

      if (agentsData) {
        setAgents(agentsData as DebateAgent[]);
      }

      // Fetch fact checks
      const { data: factChecksData } = await supabase
        .from('fact_checks')
        .select('*')
        .eq('debate_id', debateId)
        .order('created_at', { ascending: true });

      if (factChecksData) {
        setFactChecks(factChecksData as FactCheck[]);
      }
    } catch {
      setError('Failed to load summary data.');
    } finally {
      setLoading(false);
    }
  }, [debateId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // -------------------------------------------------------------------------
  // Export handlers
  // -------------------------------------------------------------------------

  const handleExportPDF = async () => {
    if (!debate || !summary) return;
    setExportingPDF(true);

    try {
      const blob = await generateDebatePDF({
        debate,
        summary,
        factChecks,
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `debate-summary-${debateId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
    } finally {
      setExportingPDF(false);
    }
  };

  const handleExportMarkdown = () => {
    if (!debate || !summary) return;
    setExportingMD(true);

    try {
      const markdown = generateDebateMarkdown({
        debate,
        summary,
        factChecks,
      });

      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `debate-summary-${debateId}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to generate Markdown:', err);
    } finally {
      setExportingMD(false);
    }
  };

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading summary...</p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------

  if (error || !debate) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="flex flex-col items-center gap-4 p-6">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <p className="text-center text-sm text-muted-foreground">
              {error || 'Debate not found.'}
            </p>
            <Button variant="outline" onClick={fetchData}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // No summary yet
  // -------------------------------------------------------------------------

  if (!summary) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="flex flex-col items-center gap-4 p-6">
            <FileText className="h-10 w-10 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Summary Not Available Yet</h2>
            <p className="text-center text-sm text-muted-foreground">
              The debate summary has not been generated yet. Please check back
              after the debate has concluded.
            </p>
            <Link href={`/debate/${debateId}`}>
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Debate
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Full summary page
  // -------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <Link href={`/debate/${debateId}`}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to debate
              </Button>
            </Link>
            <Separator orientation="vertical" className="h-6" />
            <div className="min-w-0">
              <h1 className="text-lg font-semibold truncate">{debate.topic}</h1>
              <p className="text-xs text-muted-foreground">
                Debate Summary
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <Link href={`/knowledge?debate_id=${debateId}`}>
              <Button variant="outline" size="sm">
                <Network className="h-4 w-4 mr-1" />
                Knowledge Graph
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
              disabled={exportingPDF}
            >
              {exportingPDF ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Download className="h-4 w-4 mr-1" />
              )}
              Export PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportMarkdown}
              disabled={exportingMD}
            >
              {exportingMD ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <FileText className="h-4 w-4 mr-1" />
              )}
              Export Markdown
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Moderator Summary (overall + winner analysis) */}
        <ModeratorSummary summary={summary} />

        {/* Accuracy Scorecard */}
        <AccuracyScorecard
          accuracyScores={summary.accuracy_scores}
          agents={agents}
        />

        {/* Key Arguments */}
        <KeyArgumentsList args={summary.key_arguments} />

        {/* Claim Verification */}
        <ClaimVerificationList factChecks={factChecks} />

        {/* Source Map */}
        <SourceMap sources={summary.sources_used} />

        {/* Vote Results */}
        {summary.vote_results && (
          <VoteResultsSection voteResults={summary.vote_results} />
        )}
      </main>
    </div>
  );
}
