'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { generateSessionId } from '@/lib/utils/id';
import type { VoteChoice, VoteResults } from '@/types/debate';


interface UseVotingReturn {
  submitVote: (vote: VoteChoice) => Promise<void>;
  voteResults: VoteResults | null;
  hasVoted: boolean;
  loading: boolean;
}

export function useVoting(debateId: string): UseVotingReturn {
  const [voteResults, setVoteResults] = useState<VoteResults | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchResults = useCallback(async () => {
    try {
      const res = await fetch(`/api/vote?debate_id=${encodeURIComponent(debateId)}`);
      if (!res.ok) {
        console.error('Failed to fetch vote results:', res.statusText);
        return;
      }
      const data: VoteResults = await res.json();
      setVoteResults(data);
    } catch (err) {
      console.error('Error fetching vote results:', err);
    }
  }, [debateId]);

  // Check if current session has already voted
  useEffect(() => {
    const checkExistingVote = async () => {
      const supabase = createClient();
      const sessionId = generateSessionId();

      const { data, error } = await supabase
        .from('debate_votes')
        .select('id')
        .eq('debate_id', debateId)
        .eq('voter_session_id', sessionId)
        .maybeSingle();

      if (error) {
        console.error('Failed to check existing vote:', error);
        return;
      }

      if (data) {
        setHasVoted(true);
      }
    };

    checkExistingVote();
  }, [debateId]);

  // Fetch initial results and subscribe to realtime updates
  useEffect(() => {
    fetchResults();

    const supabase = createClient();

    const channel = supabase
      .channel(`voting-${debateId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'debate_votes',
          filter: `debate_id=eq.${debateId}`,
        },
        () => {
          // Refetch results whenever a vote changes
          fetchResults();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [debateId, fetchResults]);

  const submitVote = useCallback(
    async (vote: VoteChoice) => {
      if (hasVoted) return;

      setLoading(true);
      try {
        const sessionId = generateSessionId();

        const res = await fetch('/api/vote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            debate_id: debateId,
            voter_session_id: sessionId,
            vote,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to submit vote');
        }

        setHasVoted(true);
        // Immediately refetch results for faster feedback
        await fetchResults();
      } catch (err) {
        console.error('Error submitting vote:', err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [debateId, hasVoted, fetchResults]
  );

  return { submitVote, voteResults, hasVoted, loading };
}
