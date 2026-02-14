export type NodeType = 'document' | 'claim' | 'entity' | 'concept' | 'evidence' | 'source';
export type EdgeType = 'cites' | 'supports' | 'contradicts' | 'related_to' | 'derived_from' | 'fact_checks' | 'similarity';

export interface GraphNode {
  id: string;
  debate_id: string;
  document_id: string | null;
  node_type: NodeType;
  label: string;
  title: string;
  summary: string;
  metadata: Record<string, unknown>;
  color: string;
  size: number;
  is_highlighted: boolean;
  highlight_color: string | null;
  highlighted_by_agent_id: string | null;
  citation_count: number;
  created_at: string;
}

export interface GraphEdge {
  id: string;
  debate_id: string;
  source_node_id: string;
  target_node_id: string;
  edge_type: EdgeType;
  label: string;
  weight: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface GraphData {
  nodes: GraphNodeDisplay[];
  links: GraphEdgeDisplay[];
}

export interface GraphNodeDisplay {
  id: string;
  label: string;
  title: string;
  summary: string;
  nodeType: NodeType;
  color: string;
  size: number;
  isHighlighted: boolean;
  highlightColor: string | null;
  citationCount: number;
  x?: number;
  y?: number;
}

export interface GraphEdgeDisplay {
  source: string;
  target: string;
  edgeType: EdgeType;
  label: string;
  weight: number;
}

export const NODE_COLORS: Record<string, string> = {
  pro: '#3B82F6',
  con: '#EF4444',
  both: '#8B5CF6',
  fact_check: '#FBBF24',
  verified: '#22C55E',
  default: '#6B7280',
};

export const EDGE_STYLES: Record<EdgeType, { color: string; dashed: boolean; opacity: number }> = {
  cites: { color: '#3B82F6', dashed: false, opacity: 0.8 },
  supports: { color: '#22C55E', dashed: false, opacity: 0.7 },
  contradicts: { color: '#EF4444', dashed: true, opacity: 0.8 },
  related_to: { color: '#6B7280', dashed: false, opacity: 0.4 },
  derived_from: { color: '#8B5CF6', dashed: false, opacity: 0.6 },
  fact_checks: { color: '#FBBF24', dashed: true, opacity: 0.7 },
  similarity: { color: '#6B7280', dashed: false, opacity: 0.2 },
};
