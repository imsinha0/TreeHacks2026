import { SupabaseClient } from '@supabase/supabase-js';
import { Debate, DebateTurn } from '@/types/debate';
import { DebateAgent } from '@/types/agent';
import { FactCheckResult } from '../agents/fact-checker';
import { ModeratorAgent } from '../agents/moderator';
import { conductParallelResearch, ResearchResults } from '../research/parallel-research';
import { NODE_COLORS } from '@/types/graph';
import { TurnManager } from './turn-manager';
import { generateId } from '@/lib/utils/id';

export class DebateOrchestrator {
  private turnManager: TurnManager;

  constructor(private supabase: SupabaseClient) {
    this.turnManager = new TurnManager(supabase);
  }

  async runDebate(debateId: string): Promise<void> {
    let debate: Debate;
    let agents: DebateAgent[];

    try {
      // ─── LOAD DEBATE + AGENTS ───────────────────────────────────────
      const { data: debateData, error: debateError } = await this.supabase
        .from('debates')
        .select('*')
        .eq('id', debateId)
        .single();

      if (debateError || !debateData) {
        throw new Error(`Failed to load debate ${debateId}: ${debateError?.message ?? 'Not found'}`);
      }

      debate = debateData as Debate;

      const { data: agentData, error: agentError } = await this.supabase
        .from('debate_agents')
        .select('*')
        .eq('debate_id', debateId);

      if (agentError || !agentData) {
        throw new Error(`Failed to load agents for debate ${debateId}: ${agentError?.message ?? 'Not found'}`);
      }

      agents = agentData as DebateAgent[];

      const proAgent = agents.find((a) => a.role === 'pro');
      const conAgent = agents.find((a) => a.role === 'con');

      if (!proAgent || !conAgent) {
        throw new Error('Debate requires both a pro and con agent');
      }

      // ─── RESEARCH PHASE ─────────────────────────────────────────────
      await this.updateStatus(debateId, 'researching');

      const [proResearch, conResearch] = await Promise.all([
        conductParallelResearch({
          topic: debate.topic,
          role: 'pro',
          debateId,
          researchDepth: debate.config.researchDepth,
          supabase: this.supabase,
          perplexityApiKey: process.env.PERPLEXITY_API_KEY!,
          openaiApiKey: process.env.OPENAI_API_KEY!,
        }),
        conductParallelResearch({
          topic: debate.topic,
          role: 'con',
          debateId,
          researchDepth: debate.config.researchDepth,
          supabase: this.supabase,
          perplexityApiKey: process.env.PERPLEXITY_API_KEY!,
          openaiApiKey: process.env.OPENAI_API_KEY!,
        }),
      ]);

      // Create initial graph nodes from research results
      await this.createResearchGraphNodes(debateId, proAgent, proResearch);
      await this.createResearchGraphNodes(debateId, conAgent, conResearch);

      // ─── DEBATE PHASE ───────────────────────────────────────────────
      await this.updateStatus(debateId, 'live');

      const allTurns: DebateTurn[] = [];
      const allFactChecks: FactCheckResult[] = [];
      const maxTurns = debate.config.maxTurns;

      for (let turnNumber = 1; turnNumber <= maxTurns; turnNumber++) {
        // Alternate between pro and con: odd turns = pro, even turns = con
        const isProTurn = turnNumber % 2 === 1;
        const currentAgent = isProTurn ? proAgent : conAgent;
        const currentResearch = isProTurn ? proResearch : conResearch;

        // Load updated documents for the current turn's context
        const documents = await this.loadDocuments(debateId);

        const { turn, factChecks } = await this.turnManager.processTurn({
          debate,
          agent: currentAgent,
          turnNumber,
          previousTurns: allTurns,
          researchResults: currentResearch,
          documents,
        });

        allTurns.push(turn);
        allFactChecks.push(...factChecks);
      }

      // ─── VOTING PHASE ──────────────────────────────────────────────
      await this.updateStatus(debateId, 'voting');

      // Allow time for audience to cast final votes
      await this.delay(5000);

      // ─── SUMMARY PHASE ─────────────────────────────────────────────
      await this.updateStatus(debateId, 'summarizing');

      const moderator = new ModeratorAgent(process.env.ANTHROPIC_API_KEY!);

      // Prepare turns for the moderator
      const turnsForSummary = allTurns.map((t) => {
        const turnAgent = agents.find((a) => a.id === t.agent_id);
        return {
          role: turnAgent?.role ?? 'unknown',
          content: t.content,
          turn_number: t.turn_number,
        };
      });

      // Prepare fact checks for the moderator
      const factChecksForSummary = allFactChecks.map((fc) => ({
        claim_text: fc.claim_text,
        verdict: fc.verdict,
        confidence: fc.confidence,
      }));

      // Get vote results
      const voteResults = await this.getVoteResults(debateId);

      const summary = await moderator.generateSummary({
        topic: debate.topic,
        turns: turnsForSummary,
        factChecks: factChecksForSummary,
        voteResults,
      });

      // Insert the summary into debate_summaries
      const { error: summaryError } = await this.supabase.from('debate_summaries').insert({
        id: generateId(),
        debate_id: debateId,
        overall_summary: summary.overall_summary,
        winner_analysis: summary.winner_analysis,
        accuracy_scores: summary.accuracy_scores,
        key_arguments: summary.key_arguments,
        fact_check_summary: summary.fact_check_summary,
        sources_used: summary.sources_used,
        recommendations: summary.recommendations,
        vote_results: summary.vote_results,
      });

      if (summaryError) {
        console.error('Failed to insert debate summary:', summaryError);
      }

      // ─── COMPLETED ─────────────────────────────────────────────────
      await this.updateStatus(debateId, 'completed');

    } catch (error) {
      console.error(`Debate orchestration failed for ${debateId}:`, error);

      // Set debate status to completed with error info
      const errorMessage = error instanceof Error ? error.message : 'Unknown orchestration error';

      const { error: updateError } = await this.supabase
        .from('debates')
        .update({
          status: 'completed',
          description: `[ERROR] ${errorMessage}`,
        })
        .eq('id', debateId);

      if (updateError) {
        console.error('Failed to update debate with error status:', updateError);
      }
    }
  }

  /**
   * Update the debate status in the database.
   */
  private async updateStatus(debateId: string, status: string): Promise<void> {
    const { error } = await this.supabase
      .from('debates')
      .update({ status })
      .eq('id', debateId);

    if (error) {
      console.error(`Failed to update debate status to "${status}":`, error);
    }
  }

  /**
   * Create initial knowledge graph nodes from research results.
   * Adds source nodes for Perplexity findings and connects them.
   */
  private async createResearchGraphNodes(
    debateId: string,
    agent: DebateAgent,
    research: ResearchResults
  ): Promise<void> {
    const color = agent.role === 'pro' ? NODE_COLORS.pro : NODE_COLORS.con;

    // Create nodes for each Perplexity source
    const sourceNodeIds: string[] = [];

    for (const source of research.sources) {
      if (!source.url) continue;

      const nodeId = generateId();
      const { error } = await this.supabase.from('graph_nodes').insert({
        id: nodeId,
        debate_id: debateId,
        node_type: 'source',
        label: source.title || 'Research Source',
        title: source.title || 'Research Source',
        summary: source.snippet || '',
        color,
        size: 5.0,
        metadata: {
          agent_id: agent.id,
          agent_role: agent.role,
          source_url: source.url,
          phase: 'research',
        },
      });

      if (error) {
        console.error(`Failed to create research graph node for "${source.title}":`, error);
      } else {
        sourceNodeIds.push(nodeId);
      }
    }

    // Create edges between research source nodes that belong to the same agent
    for (let i = 0; i < sourceNodeIds.length; i++) {
      for (let j = i + 1; j < sourceNodeIds.length; j++) {
        await this.supabase.from('graph_edges').insert({
          debate_id: debateId,
          source_node_id: sourceNodeIds[i],
          target_node_id: sourceNodeIds[j],
          edge_type: 'related_to',
          label: `${agent.role} research`,
          weight: 0.5,
        });
      }
    }
  }

  /**
   * Load all documents for a debate to provide context for agent turns.
   */
  private async loadDocuments(
    debateId: string
  ): Promise<Array<{ id: string; title: string; summary: string; source_url: string }>> {
    const { data, error } = await this.supabase
      .from('documents')
      .select('id, title, summary, source_url')
      .eq('debate_id', debateId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Failed to load documents:', error);
      return [];
    }

    return (data ?? []).map((doc: Record<string, unknown>) => ({
      id: String(doc.id ?? ''),
      title: String(doc.title ?? ''),
      summary: String(doc.summary ?? ''),
      source_url: String(doc.source_url ?? ''),
    }));
  }

  /**
   * Get the current vote results for a debate.
   */
  private async getVoteResults(
    debateId: string
  ): Promise<{ pro_count: number; con_count: number } | null> {
    const { data: votes, error } = await this.supabase
      .from('debate_votes')
      .select('vote')
      .eq('debate_id', debateId);

    if (error || !votes || votes.length === 0) {
      return null;
    }

    const proCount = votes.filter((v: { vote: string }) => v.vote === 'pro').length;
    const conCount = votes.filter((v: { vote: string }) => v.vote === 'con').length;

    return { pro_count: proCount, con_count: conCount };
  }

  /**
   * Utility to delay execution for a given number of milliseconds.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
