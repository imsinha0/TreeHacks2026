'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Debate, DebateTurn } from '@/types/debate';
import type { DebateAgent } from '@/types/agent';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface UseDebateRealtimeReturn {
  debate: Debate | null;
  turns: DebateTurn[];
  agents: DebateAgent[];
  loading: boolean;
  error: string | null;
}

export function useDebateRealtime(debateId: string): UseDebateRealtimeReturn {
  const [debate, setDebate] = useState<Debate | null>(null);
  const [turns, setTurns] = useState<DebateTurn[]>([]);
  const [agents, setAgents] = useState<DebateAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInitialData = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);
    setError(null);

    try {
      // Fetch debate, agents, and turns in parallel
      const [debateRes, agentsRes, turnsRes] = await Promise.all([
        supabase
          .from('debates')
          .select('*')
          .eq('id', debateId)
          .single(),
        supabase
          .from('debate_agents')
          .select('*')
          .eq('debate_id', debateId)
          .order('created_at', { ascending: true }),
        supabase
          .from('debate_turns')
          .select('*')
          .eq('debate_id', debateId)
          .order('turn_number', { ascending: true }),
      ]);

      if (debateRes.error) throw new Error(`Failed to fetch debate: ${debateRes.error.message}`);
      if (agentsRes.error) throw new Error(`Failed to fetch agents: ${agentsRes.error.message}`);
      if (turnsRes.error) throw new Error(`Failed to fetch turns: ${turnsRes.error.message}`);

      setDebate(debateRes.data as Debate);
      setAgents((agentsRes.data ?? []) as DebateAgent[]);
      setTurns((turnsRes.data ?? []) as DebateTurn[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch debate data';
      setError(message);
      console.error('useDebateRealtime fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [debateId]);

  useEffect(() => {
    fetchInitialData();

    const supabase = createClient();

    // Subscribe to debate status changes
    const channel = supabase
      .channel(`debate-realtime-${debateId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'debates',
          filter: `id=eq.${debateId}`,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const newRecord = payload.new as Record<string, unknown>;
          setDebate((prev) => (prev ? { ...prev, ...newRecord } as Debate : null));
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
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const newTurn = payload.new as DebateTurn;
          setTurns((prev) => {
            // Avoid duplicates by checking if turn already exists
            if (prev.some((t) => t.id === newTurn.id)) return prev;
            return [...prev, newTurn];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [debateId, fetchInitialData]);

  return { debate, turns, agents, loading, error };
}
