'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useVoting } from '@/hooks/useVoting';
import { useDebateRealtime } from '@/hooks/useDebateRealtime';
import { ThumbsUp, ThumbsDown, CheckCircle2, Timer, Users } from 'lucide-react';

interface VotingPanelProps {
  debateId: string;
  debateTopic: string;
}

export default function VotingPanel({ debateId, debateTopic }: VotingPanelProps) {
  const { submitVote, voteResults, hasVoted, loading } = useVoting(debateId);
  const { debate } = useDebateRealtime(debateId);
  const [countdown, setCountdown] = useState(5);
  const [isReady, setIsReady] = useState(false);

  // 5-second countdown "thinking time" before buttons become active
  useEffect(() => {
    if (countdown <= 0) {
      setIsReady(true);
      return;
    }

    const interval = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [countdown]);

  const handleVote = async (choice: 'pro' | 'con') => {
    try {
      await submitVote(choice);
    } catch (err) {
      console.error('Failed to submit vote:', err);
    }
  };

  // Results are revealed when debate status changes to 'summarizing' or 'completed'
  const showResults =
    debate?.status === 'summarizing' || debate?.status === 'completed';

  return (
    <Card className="w-full max-w-md border-border/50 bg-card/95 backdrop-blur-sm shadow-xl">
      <CardHeader className="pb-3 text-center">
        <CardTitle className="text-lg">Cast Your Vote</CardTitle>
        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
          {debateTopic}
        </p>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Voting state */}
        <AnimatePresence mode="wait">
          {hasVoted ? (
            <motion.div
              key="voted"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center gap-2 py-4"
            >
              <CheckCircle2 className="h-10 w-10 text-green-500" />
              <p className="text-sm font-semibold text-green-400">Vote submitted!</p>
              {!showResults && (
                <p className="text-xs text-muted-foreground">
                  Results will be revealed after the debate concludes.
                </p>
              )}
            </motion.div>
          ) : !isReady ? (
            <motion.div
              key="countdown"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3 py-4"
            >
              <Timer className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Take a moment to think...
              </p>
              <motion.span
                key={countdown}
                initial={{ scale: 1.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-3xl font-bold tabular-nums"
              >
                {countdown}
              </motion.span>
            </motion.div>
          ) : (
            <motion.div
              key="buttons"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="flex gap-3"
            >
              <Button
                variant="outline"
                className="flex-1 h-16 text-base font-bold bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300 hover:border-blue-500/50 transition-all"
                onClick={() => handleVote('pro')}
                disabled={loading}
              >
                <ThumbsUp className="h-5 w-5 mr-2" />
                Pro
              </Button>

              <Button
                variant="outline"
                className="flex-1 h-16 text-base font-bold bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/50 transition-all"
                onClick={() => handleVote('con')}
                disabled={loading}
              >
                <ThumbsDown className="h-5 w-5 mr-2" />
                Con
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results section - hidden until revealed */}
        {showResults && voteResults && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="space-y-3 pt-3 border-t border-border/50"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Results</h3>
              <Badge variant="secondary" className="text-[11px] gap-1">
                <Users className="h-3 w-3" />
                {voteResults.total} votes
              </Badge>
            </div>

            {/* Animated percentage bars */}
            <div className="space-y-2">
              {/* Pro bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-blue-400">Pro</span>
                  <span className="text-muted-foreground tabular-nums">
                    {voteResults.pro_percentage.toFixed(1)}%
                  </span>
                </div>
                <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${voteResults.pro_percentage}%` }}
                    transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
                    className="h-full rounded-full bg-blue-500"
                  />
                </div>
              </div>

              {/* Con bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-red-400">Con</span>
                  <span className="text-muted-foreground tabular-nums">
                    {voteResults.con_percentage.toFixed(1)}%
                  </span>
                </div>
                <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${voteResults.con_percentage}%` }}
                    transition={{ duration: 1, ease: 'easeOut', delay: 0.4 }}
                    className="h-full rounded-full bg-red-500"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
