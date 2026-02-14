-- Migration 006: Postgres functions and Realtime configuration

-- Function: Generate similarity edges between documents
CREATE OR REPLACE FUNCTION generate_similarity_edges(
  p_doc_id UUID,
  p_debate_id UUID,
  p_threshold REAL DEFAULT 0.7
)
RETURNS INTEGER AS $$
DECLARE
  edge_count INTEGER := 0;
  doc_embedding VECTOR(1536);
  similar_doc RECORD;
  new_node_id UUID;
  existing_node_id UUID;
BEGIN
  SELECT embedding INTO doc_embedding FROM documents WHERE id = p_doc_id;
  IF doc_embedding IS NULL THEN RETURN 0; END IF;

  -- Find the graph node for the current document
  SELECT id INTO new_node_id FROM graph_nodes WHERE document_id = p_doc_id LIMIT 1;
  IF new_node_id IS NULL THEN RETURN 0; END IF;

  FOR similar_doc IN
    SELECT d.id, d.title, 1 - (d.embedding <=> doc_embedding) AS similarity
    FROM documents d
    WHERE d.debate_id = p_debate_id
      AND d.id != p_doc_id
      AND d.embedding IS NOT NULL
      AND 1 - (d.embedding <=> doc_embedding) >= p_threshold
    ORDER BY similarity DESC
    LIMIT 10
  LOOP
    SELECT id INTO existing_node_id FROM graph_nodes WHERE document_id = similar_doc.id LIMIT 1;
    IF existing_node_id IS NOT NULL THEN
      INSERT INTO graph_edges (debate_id, source_node_id, target_node_id, edge_type, label, weight)
      VALUES (p_debate_id, new_node_id, existing_node_id, 'similarity',
              'Similarity: ' || round(similar_doc.similarity::numeric, 2), similar_doc.similarity)
      ON CONFLICT DO NOTHING;
      edge_count := edge_count + 1;
    END IF;
  END LOOP;

  RETURN edge_count;
END;
$$ LANGUAGE plpgsql;

-- Function: Find similar documents by query embedding
CREATE OR REPLACE FUNCTION find_similar_documents(
  p_debate_id UUID,
  p_query_embedding VECTOR(1536),
  p_limit INTEGER DEFAULT 5,
  p_threshold REAL DEFAULT 0.7
)
RETURNS TABLE(id UUID, title TEXT, summary TEXT, content TEXT, source_url TEXT, similarity REAL) AS $$
BEGIN
  RETURN QUERY
  SELECT d.id, d.title, d.summary, d.content, d.source_url,
         (1 - (d.embedding <=> p_query_embedding))::REAL AS similarity
  FROM documents d
  WHERE d.debate_id = p_debate_id
    AND d.embedding IS NOT NULL
    AND 1 - (d.embedding <=> p_query_embedding) >= p_threshold
  ORDER BY d.embedding <=> p_query_embedding
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function: Highlight a cited node
CREATE OR REPLACE FUNCTION highlight_cited_node(
  p_node_id UUID,
  p_agent_id UUID,
  p_color TEXT DEFAULT '#FBBF24'
)
RETURNS VOID AS $$
BEGIN
  UPDATE graph_nodes
  SET is_highlighted = true,
      highlight_color = p_color,
      highlighted_by_agent_id = p_agent_id,
      citation_count = citation_count + 1,
      size = LEAST(size + 1.5, 25.0)
  WHERE id = p_node_id;
END;
$$ LANGUAGE plpgsql;

-- Enable Realtime on key tables
ALTER PUBLICATION supabase_realtime ADD TABLE debate_turns;
ALTER PUBLICATION supabase_realtime ADD TABLE graph_nodes;
ALTER PUBLICATION supabase_realtime ADD TABLE graph_edges;
ALTER PUBLICATION supabase_realtime ADD TABLE lie_alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE fact_checks;
ALTER PUBLICATION supabase_realtime ADD TABLE debates;
ALTER PUBLICATION supabase_realtime ADD TABLE debate_votes;
