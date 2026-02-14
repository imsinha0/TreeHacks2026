-- Migration 003: Knowledge graph nodes and edges

CREATE TABLE graph_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id UUID NOT NULL REFERENCES debates(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  node_type TEXT NOT NULL CHECK (node_type IN ('document', 'claim', 'entity', 'concept', 'evidence', 'source')),
  label TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  color TEXT NOT NULL DEFAULT '#6B7280',
  size REAL NOT NULL DEFAULT 5.0,
  is_highlighted BOOLEAN NOT NULL DEFAULT false,
  highlight_color TEXT,
  highlighted_by_agent_id UUID REFERENCES debate_agents(id) ON DELETE SET NULL,
  citation_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE graph_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id UUID NOT NULL REFERENCES debates(id) ON DELETE CASCADE,
  source_node_id UUID NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
  target_node_id UUID NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
  edge_type TEXT NOT NULL CHECK (edge_type IN ('cites', 'supports', 'contradicts', 'related_to', 'derived_from', 'fact_checks', 'similarity')),
  label TEXT NOT NULL DEFAULT '',
  weight REAL NOT NULL DEFAULT 1.0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_graph_nodes_debate ON graph_nodes(debate_id);
CREATE INDEX idx_graph_edges_debate ON graph_edges(debate_id);
CREATE INDEX idx_graph_edges_source ON graph_edges(source_node_id);
CREATE INDEX idx_graph_edges_target ON graph_edges(target_node_id);
