import { SupabaseClient } from '@supabase/supabase-js';
import { Debate, DebateTurn } from '@/types/debate';
import { DebateAgent } from '@/types/agent';
import { FactCheckResult } from '../agents/fact-checker';
import { ModeratorAgent } from '../agents/moderator';
import { conductParallelResearch, ResearchResults } from '../research/parallel-research';
import { TurnManager, estimateDisplayTime } from './turn-manager';
import { getTurnType } from '../agents/prompts/debater-system';


export class DebateOrchestrator {
  private turnManager: TurnManager;

  constructor(private supabase: SupabaseClient) {
    this.turnManager = new TurnManager(supabase);
  }

  private log(debateId: string, message: string) {
    const ts = new Date().toISOString();
    console.log(`[Orchestrator ${debateId.slice(0, 8)}] ${ts} ${message}`);
  }

  async runDebate(debateId: string, preStartedResearch?: Promise<[ResearchResults, ResearchResults]>): Promise<void> {
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

      let proResearch: ResearchResults;
      let conResearch: ResearchResults;

      if (preStartedResearch) {
        // Research was kicked off early in the route handler
        this.log(debateId, 'Awaiting pre-started research...');
        [proResearch, conResearch] = await preStartedResearch;
      } else {
        [proResearch, conResearch] = await Promise.all([
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
      }

      this.log(debateId, `Research complete: pro=${proResearch.sources.length} sources, con=${conResearch.sources.length} sources (${Date.now() - tResearch}ms)`);

      // ─── DEBATE PHASE (PAIRED PROCESSING) ────────────────────────────
      await this.updateStatus(debateId, 'live');
      this.log(debateId, `Live phase started (maxTurns: ${debate.config.maxTurns})`);

      const allTurns: DebateTurn[] = [];
      const allFactChecks: FactCheckResult[] = [];
      const maxTurns = debate.config.maxTurns;

      // Process turns in pairs (pro + con)
      for (let pairStart = 1; pairStart <= maxTurns; pairStart += 2) {
        const proTurnNum = pairStart;
        const conTurnNum = pairStart + 1;
        const proTurnType = getTurnType(proTurnNum, maxTurns);
        const conTurnType = conTurnNum <= maxTurns ? getTurnType(conTurnNum, maxTurns) : undefined;

        const documents = await this.loadDocuments(debateId);

        if (proTurnType === 'intro') {
          // INTROS: Generate pro and con in PARALLEL (no dependency)
          this.log(debateId, `Pair ${proTurnNum}+${conTurnNum} (intros): generating in parallel...`);

          const [proGenerated, conGenerated] = await Promise.all([
            this.turnManager.generateTurn({
              debate, agent: proAgent, turnNumber: proTurnNum, turnType: proTurnType,
              previousTurns: allTurns, researchResults: proResearch, documents,
            }),
            conTurnNum <= maxTurns
              ? this.turnManager.generateTurn({
                  debate, agent: conAgent, turnNumber: conTurnNum, turnType: conTurnType!,
                  previousTurns: allTurns, researchResults: conResearch, documents,
                })
              : null,
          ]);

          // Persist pro turn (triggers frontend display)
          const proResult = await this.turnManager.persistTurn(proGenerated);
          allTurns.push(proResult.turn);
          allFactChecks.push(...proResult.factChecks);
          this.log(debateId, `Turn ${proTurnNum} persisted (pro intro)`);

          if (conGenerated) {
            // Wait for pro's speech time before showing con
            const displayTime = estimateDisplayTime(proResult.turn.content);
            this.log(debateId, `Waiting ${Math.round(displayTime / 1000)}s for pro speech...`);
            await this.delay(displayTime);

            const conResult = await this.turnManager.persistTurn(conGenerated);
            allTurns.push(conResult.turn);
            allFactChecks.push(...conResult.factChecks);
            this.log(debateId, `Turn ${conTurnNum} persisted (con intro)`);
          }
        } else {
          // REBUTTALS/CONCLUSIONS: Sequential generation (con needs pro's content)
          this.log(debateId, `Pair ${proTurnNum}+${conTurnNum} (${proTurnType}): sequential...`);

          // Generate and persist pro
          const proGenerated = await this.turnManager.generateTurn({
            debate, agent: proAgent, turnNumber: proTurnNum, turnType: proTurnType,
            previousTurns: allTurns, researchResults: proResearch, documents,
          });
          const proResult = await this.turnManager.persistTurn(proGenerated);
          allTurns.push(proResult.turn);
          allFactChecks.push(...proResult.factChecks);
          this.log(debateId, `Turn ${proTurnNum} persisted (pro ${proTurnType})`);

          if (conTurnNum <= maxTurns && conTurnType) {
            // Generate con (can now reference pro's latest argument)
            const conGenerated = await this.turnManager.generateTurn({
              debate, agent: conAgent, turnNumber: conTurnNum, turnType: conTurnType,
              previousTurns: allTurns, researchResults: conResearch, documents,
            });

            // Wait for pro's speech time
            const displayTime = estimateDisplayTime(proResult.turn.content);
            this.log(debateId, `Waiting ${Math.round(displayTime / 1000)}s for pro speech...`);
            await this.delay(displayTime);

            const conResult = await this.turnManager.persistTurn(conGenerated);
            allTurns.push(conResult.turn);
            allFactChecks.push(...conResult.factChecks);
            this.log(debateId, `Turn ${conTurnNum} persisted (con ${conTurnType})`);
          }
        }
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
