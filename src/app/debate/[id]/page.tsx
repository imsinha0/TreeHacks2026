'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { useSentenceStreaming } from '@/hooks/useSentenceStreaming';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Debate, DebateTurn, Citation } from '@/types/debate';
import type { DebateAgent } from '@/types/agent';
import Image from 'next/image';
import {
  Play,
  Loader2,
  AlertCircle,
  MessageSquare,
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
  isLatest?: boolean;
}

function DebateTurnCard({ turn, agentName, agentRole, isLatest }: DebateTurnCardProps) {
  const isProSide = agentRole === 'pro';
  const { visibleText, isStreaming } = useSentenceStreaming(turn.content, !!isLatest);

  return (
    <Card
      className={`mb-3 border-l-4 ${
        isProSide ? 'border-l-blue-500' : 'border-l-red-500'
      }`}
    >
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image
              src={isProSide ? '/avatars/pro-agent.svg' : '/avatars/con-agent.svg'}
              alt={agentName}
              width={16}
              height={16}
              className="rounded-full"
            />
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
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {visibleText}
          {isStreaming && <span className="inline-block w-0.5 h-4 bg-foreground animate-pulse ml-0.5 align-middle" />}
        </p>
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
              Gathering sources and preparing arguments...
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
  const startInProgressRef = useRef(false);
  const { enqueue, isPlaying, currentUrl } = useAudioPlayer();
  const lastEnqueuedTurnRef = useRef<string | null>(null);

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
          console.log('[Realtime] debate update:', payload.new);
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
          console.log('[Realtime] new turn:', payload.new);
          const newTurn = payload.new as DebateTurn;
          setTurns((prev) => {
            if (prev.some((t) => t.id === newTurn.id)) return prev;
            return [...prev, newTurn];
          });
          // Speaking state is now tracked via audio playback (see useEffect below)

          // Show "Fact-Checking" toast after a short delay
          setTimeout(() => {
            toast({
              title: 'Fact-Checking',
              description: 'Checking claims from this argument...',
            });
          }, 3000);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'fact_checks',
          filter: `debate_id=eq.${debateId}`,
        },
        (payload) => {
          console.log('[Realtime] fact check:', payload.new);
          const fc = payload.new as { verdict?: string; claim_text?: string };
          const verdict = fc.verdict ?? 'checked';
          const isLie = verdict === 'false' || verdict === 'mostly_false';
          toast({
            title: isLie ? 'False Claim Detected' : 'Claim Verified',
            description: fc.claim_text
              ? `"${fc.claim_text.slice(0, 100)}${fc.claim_text.length > 100 ? '...' : ''}" — ${verdict}`
              : `Verdict: ${verdict}`,
            variant: isLie ? 'destructive' : 'default',
          });
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] subscription status:', status);
      });

    return () => {
      supabase.removeChannel(debateChannel);
    };
  }, [debateId]);

  // -------------------------------------------------------------------------
  // Polling fallback: refetch debate status + turns every 3s while active
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!debateId || !debate) return;

    // Only poll while the debate is in an active state
    const activeStatuses = ['researching', 'live', 'voting', 'summarizing'];
    if (!activeStatuses.includes(debate.status)) return;

    const supabase = createClient();

    console.log('[Poll] Starting polling interval (current status:', debate.status, ')');

    const interval = setInterval(async () => {
      console.log('[Poll] tick');
      // Poll debate status
      const { data: debateData } = await supabase
        .from('debates')
        .select('*')
        .eq('id', debateId)
        .single();

      if (debateData) {
        setDebate((prev) => {
          if (!prev) return debateData as Debate;
          // Only update if status actually changed
          if (prev.status !== debateData.status) {
            console.log('[Poll] status changed:', prev.status, '->', debateData.status);
          }
          return { ...prev, ...(debateData as Debate) };
        });
      }

      // Poll for new turns
      const { data: turnsData } = await supabase
        .from('debate_turns')
        .select('*')
        .eq('debate_id', debateId)
        .order('turn_number', { ascending: true });

      if (turnsData) {
        setTurns((prev) => {
          if (turnsData.length !== prev.length) {
            console.log('[Poll] turns updated:', prev.length, '->', turnsData.length);
          }
          return turnsData as DebateTurn[];
        });
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [debateId, debate?.status]);

  // -------------------------------------------------------------------------
  // Auto-scroll to bottom when new turns arrive
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns]);

  // -------------------------------------------------------------------------
  // Auto-play TTS audio when new turns arrive
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (turns.length === 0) return;
    const lastTurn = turns[turns.length - 1];
    if (!lastTurn.audio_url) return;
    if (lastEnqueuedTurnRef.current === lastTurn.id) return;
    lastEnqueuedTurnRef.current = lastTurn.id;
    enqueue(lastTurn.audio_url);
  }, [turns, enqueue]);

  // -------------------------------------------------------------------------
  // Track speaking agent based on audio playback state
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (isPlaying && currentUrl) {
      const playingTurn = turns.find((t) => t.audio_url === currentUrl);
      if (playingTurn) {
        setSpeakingAgentId(playingTurn.agent_id);
      }
    } else {
      setSpeakingAgentId(null);
    }
  }, [isPlaying, currentUrl, turns]);

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
    if (startInProgressRef.current) return;
    startInProgressRef.current = true;
    setStarting(true);

    try {
      const response = await fetch(`/api/debate/${debateId}/start`, {
        method: 'POST',
      });

      if (response.ok) {
        // Refetch so UI immediately shows researching (don't rely only on realtime)
        await fetchDebate();
        return;
      }

      const data = await response.json().catch(() => ({}));
      const msg = data.error || 'Failed to start debate.';
      // If debate was already started (e.g. double submit), refetch instead of showing error
      if (response.status === 400 && typeof msg === 'string' && msg.includes('cannot be started from status')) {
        await fetchDebate();
        return;
      }
      setError(msg);
    } catch {
      setError('Failed to start debate.');
    } finally {
      setStarting(false);
      startInProgressRef.current = false;
    }
  };

  // -------------------------------------------------------------------------
  // Debug: log every render to trace state transitions
  // -------------------------------------------------------------------------

  console.log('[DebatePage render]', {
    loading,
    error,
    status: debate?.status ?? 'null',
    turnsCount: turns.length,
    agentsCount: agents.length,
  });

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
    return (
      <div>
        <ResearchingState topic={debate.topic} />
        {/* Debug: visible status indicator */}
        <div className="fixed bottom-4 right-4 bg-yellow-500 text-black text-xs px-3 py-1.5 rounded-full font-mono z-50">
          status: {debate.status} | turns: {turns.length}
        </div>
      </div>
    );
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
            <div
              className={`h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center overflow-hidden ${
                speakingAgentId === proAgent?.id ? 'animate-pulse-glow' : ''
              }`}
              style={speakingAgentId === proAgent?.id ? { '--glow-color': 'rgba(59,130,246,0.5)' } as React.CSSProperties : undefined}
            >
              <Image src="/avatars/pro-agent.svg" alt="Pro Agent" width={32} height={32} className="rounded-full" />
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
            <div
              className={`h-8 w-8 rounded-full bg-red-500/20 flex items-center justify-center overflow-hidden ${
                speakingAgentId === conAgent?.id ? 'animate-pulse-glow' : ''
              }`}
              style={speakingAgentId === conAgent?.id ? { '--glow-color': 'rgba(239,68,68,0.5)' } as React.CSSProperties : undefined}
            >
              <Image src="/avatars/con-agent.svg" alt="Con Agent" width={32} height={32} className="rounded-full" />
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
            turns.map((turn, index) => {
              const agent = agentMap[turn.agent_id];
              return (
                <DebateTurnCard
                  key={turn.id}
                  turn={turn}
                  agentName={agent?.name || 'Unknown Agent'}
                  agentRole={agent?.role || 'pro'}
                  isLatest={index === turns.length - 1 && debate.status === 'live'}
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

  return (
    <div className="h-[calc(100vh-3.5rem)] overflow-hidden">
      {debatePanel}
      {/* Debug: visible status indicator */}
      <div className="fixed bottom-4 right-4 bg-green-500 text-black text-xs px-3 py-1.5 rounded-full font-mono z-50">
        status: {debate.status} | turns: {turns.length}
      </div>
    </div>
  );
}
