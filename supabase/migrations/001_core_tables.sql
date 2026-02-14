-- Migration 001: Core tables for debates, agents, and turns

CREATE TABLE debates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'setup' CHECK (status IN ('setup', 'researching', 'live', 'summarizing', 'voting', 'completed')),
  config JSONB NOT NULL DEFAULT '{
    "maxTurns": 6,
    "turnTimeLimitSec": 120,
    "researchDepth": "standard",
    "voiceEnabled": true,
    "avatarEnabled": true,
    "debateType": "standard"
  }'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE debate_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id UUID NOT NULL REFERENCES debates(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('pro', 'con', 'fact_checker', 'moderator')),
  name TEXT NOT NULL,
  avatar_id TEXT,
  voice_id TEXT NOT NULL DEFAULT 'alloy',
  system_prompt TEXT NOT NULL DEFAULT '',
  persona_description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE debate_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id UUID NOT NULL REFERENCES debates(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES debate_agents(id) ON DELETE CASCADE,
  turn_number INTEGER NOT NULL,
  content TEXT NOT NULL,
  research_sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  audio_url TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_debate_agents_debate ON debate_agents(debate_id);
CREATE INDEX idx_debate_turns_debate ON debate_turns(debate_id);
CREATE INDEX idx_debate_turns_number ON debate_turns(debate_id, turn_number);
