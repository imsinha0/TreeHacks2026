-- Migration 005: Voting and debate summaries

CREATE TABLE debate_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id UUID NOT NULL REFERENCES debates(id) ON DELETE CASCADE,
  voter_session_id TEXT NOT NULL,
  vote TEXT NOT NULL CHECK (vote IN ('pro', 'con')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(debate_id, voter_session_id)
);

CREATE TABLE debate_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id UUID NOT NULL REFERENCES debates(id) ON DELETE CASCADE UNIQUE,
  overall_summary TEXT NOT NULL DEFAULT '',
  winner_analysis TEXT NOT NULL DEFAULT '',
  accuracy_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  key_arguments JSONB NOT NULL DEFAULT '[]'::jsonb,
  fact_check_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  sources_used JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommendations TEXT NOT NULL DEFAULT '',
  vote_results JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_debate_votes_debate ON debate_votes(debate_id);
