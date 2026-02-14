-- Migration 004: Fact checks and lie alerts

CREATE TABLE fact_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id UUID NOT NULL REFERENCES debates(id) ON DELETE CASCADE,
  turn_id UUID NOT NULL REFERENCES debate_turns(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES debate_agents(id) ON DELETE CASCADE,
  claim_text TEXT NOT NULL,
  verdict TEXT NOT NULL CHECK (verdict IN ('true', 'mostly_true', 'mixed', 'mostly_false', 'false', 'unverifiable')),
  explanation TEXT NOT NULL DEFAULT '',
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence REAL NOT NULL DEFAULT 0.0,
  is_lie BOOLEAN NOT NULL DEFAULT false,
  graph_node_id UUID REFERENCES graph_nodes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE lie_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id UUID NOT NULL REFERENCES debates(id) ON DELETE CASCADE,
  fact_check_id UUID NOT NULL REFERENCES fact_checks(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,
  claim_text TEXT NOT NULL,
  explanation TEXT NOT NULL DEFAULT '',
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('warning', 'critical')),
  dismissed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fact_checks_debate ON fact_checks(debate_id);
CREATE INDEX idx_fact_checks_turn ON fact_checks(turn_id);
CREATE INDEX idx_lie_alerts_debate ON lie_alerts(debate_id);
