-- Migration 003: Ultra-optimized document embeddings table for knowledge graph visualization
-- This table stores ONLY document ID and embeddings for maximum performance
-- Join with documents table if you need metadata (title, summary, etc.)

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.document_embeddings (
  id UUID PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
  embedding VECTOR(1536) NOT NULL
);

-- Index for fast similarity search using HNSW (much faster than sequential scan)
CREATE INDEX IF NOT EXISTS idx_document_embeddings_embedding 
  ON public.document_embeddings 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

COMMENT ON TABLE public.document_embeddings IS 'Ultra-optimized table storing only document IDs and embeddings. Join with documents table for metadata.';
COMMENT ON COLUMN public.document_embeddings.id IS 'References documents.id - foreign key relationship';
COMMENT ON COLUMN public.document_embeddings.embedding IS '1536-dimensional vector embedding (OpenAI text-embedding-3-small)';

