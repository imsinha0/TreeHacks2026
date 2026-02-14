-- Migration 002: Documents with vector embeddings

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id UUID NOT NULL REFERENCES debates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  source_url TEXT,
  source_type TEXT NOT NULL DEFAULT 'web' CHECK (source_type IN ('upload', 'perplexity', 'graph_discovery', 'web')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_debate ON documents(debate_id);
CREATE INDEX idx_documents_embedding ON documents USING hnsw (embedding vector_cosine_ops);
