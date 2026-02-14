'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { DebateLayout } from '@/components/layout/DebateLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Debate, DebateTurn, Citation } from '@/types/debate';
import type { DebateAgent } from '@/types/agent';
import {
  Play,
  Loader2,
  AlertCircle,
  MessageSquare,
  User,
  ExternalLink,
  Vote,
  Brain,
  Mic,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Inline DebateTurnCard component
// ---------------------------------------------------------------------------

interface DebateTurnCardProps {
  turn: DebateTurn;
  agentName: string;
  agentRole: string;
}

function DebateTurnCard({ turn, agentName, agentRole }: DebateTurnCardProps) {
  const isProSide = agentRole === 'pro';

  return (
    <Card
      className={`mb-3 border-l-4 ${
        isProSide ? 'border-l-blue-500' : 'border-l-red-500'
      }`}
    >
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold text-sm">{agentName}</span>
            <Badge variant={isProSide ? 'default' : 'destructive'} className="text-[10px] px-1.5 py-0">
              {agentRole.toUpperCase()}
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground">
            Turn {turn.turn_number}
          </span>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{turn.content}</p>
        {turn.citations && turn.citations.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {turn.citations.map((citation: Citation, idx: number) => (
              <Badge
                key={idx}
                variant="outline"
                className="text-[10px] gap-1 cursor-pointer hover:bg-accent"
              >
                {citation.source_url ? (
                  <a
                    href={citation.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {citation.label}
                  </a>
                ) : (
                  <>
                    <MessageSquare className="h-3 w-3" />
                    {citation.label}
                  </>
                )}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Status-specific components
// ---------------------------------------------------------------------------

function LoadingState() {
  return (
    <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading debate...</p>
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
      <Card className="max-w-md">
        <CardContent className="flex flex-col items-center gap-4 p-6">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <p className="text-center text-sm text-muted-foreground">{message}</p>
          {onRetry && (
            <Button variant="outline" onClick={onRetry}>
              Try Again
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ResearchingState({ topic }: { topic: string }) {
  return (
    <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
      <Card className="max-w-lg w-full mx-4">
        <CardContent className="flex flex-col items-center gap-6 p-8">
          <div className="relative">
            <Brain className="h-12 w-12 text-primary animate-pulse" />
            <div className="absolute -inset-2 rounded-full border-2 border-primary/30 animate-ping" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold">Researching...</h2>
            <p className="text-sm text-muted-foreground">
              AI agents are researching the topic to build their arguments.
            </p>
            <p className="text-xs text-muted-foreground italic mt-2">
              &ldquo;{topic}&rdquo;
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Gathering sources and building knowledge graph...
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummarizingState() {
  return (
    <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
      <Card className="max-w-lg w-full mx-4">
        <CardContent className="flex flex-col items-center gap-6 p-8">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold">Generating Summary...</h2>
            <p className="text-sm text-muted-foreground">
              Analyzing the debate and preparing the final summary report.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function VotingOverlay({
  debateId,
  onVoteSubmitted,
}: {
  debateId: string;
  onVoteSubmitted: () => void;
}) {
  const [voted, setVoted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleVote = async (choice: 'pro' | 'con') => {
    setSubmitting(true);
    try {
      const supabase = createClient();
      const sessionId =
        typeof window !== 'undefined'
          ? window.sessionStorage.getItem('voter_session_id') ||
            crypto.randomUUID()
          : crypto.randomUUID();
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('voter_session_id', sessionId);
      }

      await supabase.from('debate_votes').insert({
        debate_id: debateId,
        voter_session_id: sessionId,
        vote: choice,
      });

      setVoted(true);
      onVoteSubmitted();
    } catch {
      // silently fail for now
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <Card className="max-w-md w-full mx-4">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2">
            <Vote className="h-8 w-8 text-primary" />
          </div>
          <CardTitle>Cast Your Vote</CardTitle>
          <CardDescription>
            Who presented the stronger argument?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {voted ? (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">
                Thank you for voting! Waiting for results...
              </p>
            </div>
          ) : (
            <div className="flex gap-3">
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                onClick={() => handleVote('pro')}
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'PRO'
                )}
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700"
                onClick={() => handleVote('con')}
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'CON'
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function DebatePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const debateId = params.id;

  const [debate, setDebate] = useState<Debate | null>(null);
  const [agents, setAgents] = useState<DebateAgent[]>([]);
  const [turns, setTurns] = useState<DebateTurn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [speakingAgentId, setSpeakingAgentId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Map agent IDs to agent info for quick lookup
  const agentMap = agents.reduce<Record<string, DebateAgent>>((acc, agent) => {
    acc[agent.id] = agent;
    return acc;
  }, {});

  const proAgent = agents.find((a) => a.role === 'pro');
  const conAgent = agents.find((a) => a.role === 'con');

  // -------------------------------------------------------------------------
  // Fetch initial debate data
  // -------------------------------------------------------------------------

  const fetchDebate = useCallback(async () => {
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

      // Fetch agents
      const { data: agentsData } = await supabase
        .from('debate_agents')
        .select('*')
        .eq('debate_id', debateId);

      if (agentsData) {
        setAgents(agentsData as DebateAgent[]);
      }

      // Fetch turns
      const { data: turnsData } = await supabase
        .from('debate_turns')
        .select('*')
        .eq('debate_id', debateId)
        .order('turn_number', { ascending: true });

      if (turnsData) {
        setTurns(turnsData as DebateTurn[]);
      }
    } catch {
      setError('Failed to load debate data.');
    } finally {
      setLoading(false);
    }
  }, [debateId]);

  useEffect(() => {
    fetchDebate();
  }, [fetchDebate]);

  // -------------------------------------------------------------------------
  // Realtime subscription for debate status and turns
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!debateId) return;

    const supabase = createClient();

    // Subscribe to debate status changes
    const debateChannel = supabase
      .channel(`debate-${debateId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'debates',
          filter: `id=eq.${debateId}`,
        },
        (payload) => {
          const updated = payload.new as Debate;
          setDebate((prev) => (prev ? { ...prev, ...updated } : null));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'debate_turns',
          filter: `debate_id=eq.${debateId}`,
        },
        (payload) => {
          const newTurn = payload.new as DebateTurn;
          setTurns((prev) => {
            // Avoid duplicates
            if (prev.some((t) => t.id === newTurn.id)) return prev;
            return [...prev, newTurn];
          });
          setSpeakingAgentId(newTurn.agent_id);
          // Clear speaking indicator after a short delay
          setTimeout(() => setSpeakingAgentId(null), 2000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(debateChannel);
    };
  }, [debateId]);

  // -------------------------------------------------------------------------
  // Auto-scroll to bottom when new turns arrive
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns]);

  // -------------------------------------------------------------------------
  // Redirect on completed status
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (debate?.status === 'completed') {
      router.push(`/debate/${debateId}/summary`);
    }
  }, [debate?.status, debateId, router]);

  // -------------------------------------------------------------------------
  // Start debate handler
  // -------------------------------------------------------------------------

  const handleStartDebate = async () => {
    if (!debateId) return;
    setStarting(true);

    try {
      const response = await fetch(`/api/debate/${debateId}/start`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to start debate.');
      }
    } catch {
      setError('Failed to start debate.');
    } finally {
      setStarting(false);
    }
  };

  // -------------------------------------------------------------------------
  // Loading and error states
  // -------------------------------------------------------------------------

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchDebate} />;
  }

  if (!debate) {
    return <ErrorState message="Debate not found." />;
  }

  // -------------------------------------------------------------------------
  // Status-specific full-page states
  // -------------------------------------------------------------------------

  if (debate.status === 'researching') {
    return <ResearchingState topic={debate.topic} />;
  }

  if (debate.status === 'summarizing') {
    return <SummarizingState />;
  }

  // -------------------------------------------------------------------------
  // Setup state: show debate info and start button
  // -------------------------------------------------------------------------

  if (debate.status === 'setup') {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <Card className="max-w-lg w-full mx-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <Badge variant="secondary">Setup</Badge>
              <Badge variant="outline">{debate.config.debateType}</Badge>
            </div>
            <CardTitle className="mt-3 text-2xl">{debate.topic}</CardTitle>
            {debate.description && (
              <CardDescription className="mt-1">
                {debate.description}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="space-y-1">
                <p className="text-muted-foreground">Max Turns</p>
                <p className="font-medium">{debate.config.maxTurns}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Research Depth</p>
                <p className="font-medium capitalize">
                  {debate.config.researchDepth}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Turn Time Limit</p>
                <p className="font-medium">
                  {debate.config.turnTimeLimitSec}s
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Voice</p>
                <p className="font-medium">
                  {debate.config.voiceEnabled ? 'Enabled' : 'Disabled'}
                </p>
              </div>
            </div>

            {agents.length > 0 && (
              <div className="border-t pt-4 space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Agents
                </p>
                {agents
                  .filter((a) => a.role === 'pro' || a.role === 'con')
                  .map((agent) => (
                    <div
                      key={agent.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Badge
                        variant={
                          agent.role === 'pro' ? 'default' : 'destructive'
                        }
                        className="text-[10px] w-10 justify-center"
                      >
                        {agent.role.toUpperCase()}
                      </Badge>
                      <span className="font-medium">{agent.name}</span>
                      {agent.persona_description && (
                        <span className="text-muted-foreground truncate">
                          - {agent.persona_description}
                        </span>
                      )}
                    </div>
                  ))}
              </div>
            )}

            <Button
              className="w-full mt-4"
              size="lg"
              onClick={handleStartDebate}
              disabled={starting}
            >
              {starting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Start Debate
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Live / Voting state: full debate theater
  // -------------------------------------------------------------------------

  const debatePanel = (
    <div className="flex flex-col h-full relative">
      {/* Agent panels at top */}
      <div className="flex border-b border-border shrink-0">
        {/* Pro agent */}
        <div
          className={`flex-1 p-3 border-r border-border transition-colors ${
            speakingAgentId === proAgent?.id ? 'bg-blue-500/10' : ''
          }`}
        >
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center">
              <User className="h-4 w-4 text-blue-500" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold truncate">
                  {proAgent?.name || 'Pro Agent'}
                </p>
                <Badge className="text-[10px] px-1.5 py-0 bg-blue-600">
                  PRO
                </Badge>
              </div>
              {proAgent?.persona_description && (
                <p className="text-xs text-muted-foreground truncate">
                  {proAgent.persona_description}
                </p>
              )}
            </div>
            {speakingAgentId === proAgent?.id && (
              <Mic className="h-4 w-4 text-blue-500 animate-pulse ml-auto shrink-0" />
            )}
          </div>
        </div>

        {/* Con agent */}
        <div
          className={`flex-1 p-3 transition-colors ${
            speakingAgentId === conAgent?.id ? 'bg-red-500/10' : ''
          }`}
        >
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-red-500/20 flex items-center justify-center">
              <User className="h-4 w-4 text-red-500" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold truncate">
                  {conAgent?.name || 'Con Agent'}
                </p>
                <Badge className="text-[10px] px-1.5 py-0 bg-red-600">
                  CON
                </Badge>
              </div>
              {conAgent?.persona_description && (
                <p className="text-xs text-muted-foreground truncate">
                  {conAgent.persona_description}
                </p>
              )}
            </div>
            {speakingAgentId === conAgent?.id && (
              <Mic className="h-4 w-4 text-red-500 animate-pulse ml-auto shrink-0" />
            )}
          </div>
        </div>
      </div>

      {/* Topic bar */}
      <div className="px-4 py-2 border-b border-border bg-muted/30 shrink-0">
        <p className="text-xs text-muted-foreground">Topic</p>
        <p className="text-sm font-medium">{debate.topic}</p>
      </div>

      {/* Transcript */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-1" ref={scrollRef}>
          {turns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mb-3" />
              <p className="text-sm">
                {debate.status === 'live'
                  ? 'Waiting for the first argument...'
                  : 'No turns yet.'}
              </p>
            </div>
          ) : (
            turns.map((turn) => {
              const agent = agentMap[turn.agent_id];
              return (
                <DebateTurnCard
                  key={turn.id}
                  turn={turn}
                  agentName={agent?.name || 'Unknown Agent'}
                  agentRole={agent?.role || 'pro'}
                />
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Voting overlay */}
      {debate.status === 'voting' && (
        <VotingOverlay
          debateId={debate.id}
          onVoteSubmitted={() => {
            // Vote submitted; realtime subscription will handle status update
          }}
        />
      )}
    </div>
  );

  const graphPanel = (
    <div className="flex h-full items-center justify-center bg-muted/20">
      <div className="text-center space-y-2">
        <Brain className="h-10 w-10 text-muted-foreground mx-auto" />
        <p className="text-sm font-medium text-muted-foreground">
          Knowledge Graph
        </p>
        <p className="text-xs text-muted-foreground">
          Will be displayed here during the debate
        </p>
      </div>
    </div>
  );

  return <DebateLayout debatePanel={debatePanel} graphPanel={graphPanel} />;
}
