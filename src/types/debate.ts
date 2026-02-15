export type DebateStatus = 'setup' | 'researching' | 'live' | 'summarizing' | 'voting' | 'completed';
export type DebateType = 'standard' | 'court_simulation';
export type VoteChoice = 'pro' | 'con';

export interface DebateConfig {
  maxTurns: number;
  turnTimeLimitSec: number;
  researchDepth: 'quick' | 'standard' | 'deep';
  voiceEnabled: boolean;
  debateType: DebateType;
}

export interface Debate {
  id: string;
  topic: string;
  description: string;
  status: DebateStatus;
  config: DebateConfig;
  created_at: string;
}

export type TurnType = 'intro' | 'rebuttal' | 'conclusion';

export interface DebateTurn {
  id: string;
  debate_id: string;
  agent_id: string;
  turn_number: number;
  turn_type?: TurnType;
  content: string;
  research_sources: ResearchSource[];
  citations: Citation[];
  audio_url: string | null;
  duration_ms: number | null;
  created_at: string;
}

export interface ResearchSource {
  url: string;
  title: string;
  snippet: string;
}

export interface Citation {
  label: string;
  source_url?: string;
}

export interface DebateVote {
  id: string;
  debate_id: string;
  voter_session_id: string;
  vote: VoteChoice;
  created_at: string;
}

export interface DebateSummary {
  id: string;
  debate_id: string;
  overall_summary: string;
  winner_analysis: string;
  accuracy_scores: Record<string, number>;
  key_arguments: KeyArgument[];
  fact_check_summary: FactCheckSummaryData;
  sources_used: SourceUsed[];
  recommendations: string;
  vote_results: VoteResults | null;
  created_at: string;
}

export interface KeyArgument {
  agent_role: string;
  argument: string;
  strength: number;
  supported_by: string[];
}

export interface FactCheckSummaryData {
  total_claims: number;
  verified_true: number;
  verified_false: number;
  mixed: number;
  unverifiable: number;
}

export interface SourceUsed {
  url: string;
  title: string;
  cited_by: string[];
  reliability: number;
}

export interface VoteResults {
  pro_count: number;
  con_count: number;
  total: number;
  pro_percentage: number;
  con_percentage: number;
}
