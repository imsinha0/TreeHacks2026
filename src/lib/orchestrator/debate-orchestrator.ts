import { SupabaseClient } from '@supabase/supabase-js';
import { Debate, DebateTurn } from '@/types/debate';
import { DebateAgent } from '@/types/agent';
import { FactCheckResult } from '../agents/fact-checker';
import { ModeratorAgent } from '../agents/moderator';
import { conductParallelResearch } from '../research/parallel-research';
import { TurnManager } from './turn-manager';


export class DebateOrchestrator {
  private turnManager: TurnManager;

  constructor(private supabase: SupabaseClient) {
    this.turnManager = new TurnManager(supabase);
  }

  private log(debateId: string, message: string) {
    const ts = new Date().toISOString();
    console.log(`[Orchestrator ${debateId.slice(0, 8)}] ${ts} ${message}`);
  }

  async runDebate(debateId: string): Promise<void> {
    const t0 = Date.now();
    let debate: Debate;
    let agents: DebateAgent[];

    try {
      // ─── LOAD DEBATE + AGENTS ───────────────────────────────────────
      this.log(debateId, 'Loading debate + agents...');

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

      this.log(debateId, `Loaded debate "${debate.topic}" with ${agents.length} agents (${Date.now() - t0}ms)`);

      // ─── RESEARCH PHASE ─────────────────────────────────────────────
      await this.updateStatus(debateId, 'researching');
      const tResearch = Date.now();
      this.log(debateId, `Research phase started (depth: ${debate.config.researchDepth})`);

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

      this.log(debateId, `Research complete: pro=${proResearch.sources.length} sources, con=${conResearch.sources.length} sources (${Date.now() - tResearch}ms)`);

      // ─── DEBATE PHASE ───────────────────────────────────────────────
      await this.updateStatus(debateId, 'live');
      this.log(debateId, `Live phase started (maxTurns: ${debate.config.maxTurns})`);

      const allTurns: DebateTurn[] = [];
      const allFactChecks: FactCheckResult[] = [];
      const maxTurns = debate.config.maxTurns;

      for (let turnNumber = 1; turnNumber <= maxTurns; turnNumber++) {
        const tTurn = Date.now();
        const isProTurn = turnNumber % 2 === 1;
        const currentAgent = isProTurn ? proAgent : conAgent;
        const currentResearch = isProTurn ? proResearch : conResearch;

        this.log(debateId, `Turn ${turnNumber}/${maxTurns} (${currentAgent.role}) starting...`);

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

        this.log(debateId, `Turn ${turnNumber} done: ${turn.content.length} chars, ${factChecks.length} fact checks (${Date.now() - tTurn}ms)`);
      }

      // ─── VOTING PHASE ──────────────────────────────────────────────
      await this.updateStatus(debateId, 'voting');
      this.log(debateId, 'Voting phase (5s window)');

      await this.delay(5000);

      // ─── SUMMARY PHASE ─────────────────────────────────────────────
      await this.updateStatus(debateId, 'summarizing');
      const tSummary = Date.now();
      this.log(debateId, 'Generating summary...');

      const moderator = new ModeratorAgent(process.env.ANTHROPIC_API_KEY!);

      const turnsForSummary = allTurns.map((t) => {
        const turnAgent = agents.find((a) => a.id === t.agent_id);
        return {
          role: turnAgent?.role ?? 'unknown',
          content: t.content,
          turn_number: t.turn_number,
        };
      });

      const factChecksForSummary = allFactChecks.map((fc) => ({
        claim_text: fc.claim_text,
        verdict: fc.verdict,
        confidence: fc.confidence,
      }));

      const voteResults = await this.getVoteResults(debateId);

      const summary = await moderator.generateSummary({
        topic: debate.topic,
        turns: turnsForSummary,
        factChecks: factChecksForSummary,
        voteResults,
      });

      const { error: summaryError } = await this.supabase.from('debate_summaries').insert({
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

      this.log(debateId, `Summary done (${Date.now() - tSummary}ms)`);

      // ─── COMPLETED ─────────────────────────────────────────────────
      await this.updateStatus(debateId, 'completed');
      this.log(debateId, `Debate completed. Total time: ${Date.now() - t0}ms`);

    } catch (error) {
      console.error(`[Orchestrator ${debateId.slice(0, 8)}] FAILED (${Date.now() - t0}ms):`, error);

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
