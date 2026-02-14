export type AgentRole = 'pro' | 'con' | 'fact_checker' | 'moderator';

export interface DebateAgent {
  id: string;
  debate_id: string;
  role: AgentRole;
  name: string;
  avatar_id: string | null;
  voice_id: string;
  system_prompt: string;
  persona_description: string;
  created_at: string;
}

export interface FactCheck {
  id: string;
  debate_id: string;
  turn_id: string;
  agent_id: string;
  claim_text: string;
  verdict: FactCheckVerdict;
  explanation: string;
  sources: FactCheckSource[];
  confidence: number;
  is_lie: boolean;
  graph_node_id: string | null;
  created_at: string;
}

export type FactCheckVerdict = 'true' | 'mostly_true' | 'mixed' | 'mostly_false' | 'false' | 'unverifiable';

export interface FactCheckSource {
  url: string;
  title: string;
  relevant_text: string;
}

export interface LieAlert {
  id: string;
  debate_id: string;
  fact_check_id: string;
  agent_name: string;
  claim_text: string;
  explanation: string;
  severity: 'warning' | 'critical';
  dismissed: boolean;
  created_at: string;
}

export interface AgentResponse {
  argument: string;
  citations: AgentCitation[];
  claims: string[];
  graph_nodes: AgentGraphNode[];
}

export interface AgentCitation {
  document_id: string;
  label: string;
  source_url?: string;
}

export interface AgentGraphNode {
  label: string;
  node_type: 'claim' | 'evidence' | 'source';
  summary: string;
  source_url?: string;
}
