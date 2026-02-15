import { SupabaseClient } from '@supabase/supabase-js';
import { Debate, DebateTurn, Citation } from '@/types/debate';
import { DebateAgent, AgentResponse } from '@/types/agent';
import { ResearchResults } from '@/lib/research/parallel-research';
import { DebaterAgent } from '../agents/debater';
import { FactCheckerAgent, FactCheckResult } from '../agents/fact-checker';

interface Document {
  id: string;
  title: string;
  summary: string;
  source_url: string;
}

export class TurnManager {
  constructor(private supabase: SupabaseClient) {}

  async processTurn(params: {
    debate: Debate;
    agent: DebateAgent;
    turnNumber: number;
    previousTurns: DebateTurn[];
    researchResults: ResearchResults;
    documents: Document[];
  }): Promise<{ turn: DebateTurn; factChecks: FactCheckResult[] }> {
    const { debate, agent, turnNumber, previousTurns, researchResults, documents } = params;

    // 1. Generate the argument via Claude
    const tDebater = Date.now();
    console.log(`[TurnManager] Turn ${turnNumber}: calling debater (${agent.role})...`);

    const debaterAgent = new DebaterAgent(
      agent.role as 'pro' | 'con',
      process.env.ANTHROPIC_API_KEY!
    );

    const agentResponse = await debaterAgent.generateArgument({
      topic: debate.topic,
      debateType: debate.config.debateType,
      persona: agent.persona_description,
      previousTurns: previousTurns.map((t) => ({
        role: t.agent_id === agent.id ? agent.role : (agent.role === 'pro' ? 'con' : 'pro'),
        content: t.content,
      })),
      researchContext: researchResults.combinedContext,
      documents: documents.map((doc) => ({
        id: doc.id,
        title: doc.title,
        summary: doc.summary,
        source_url: doc.source_url,
      })),
    });

    console.log(`[TurnManager] Turn ${turnNumber}: debater done (${Date.now() - tDebater}ms), ${agentResponse.claims.length} claims`);

    // 2. Build citations
    const citations: Citation[] = agentResponse.citations.map((c) => ({
      label: c.label,
      source_url: c.source_url,
    }));

    // 3. Build research sources from the research results
    const researchSources = researchResults.sources.map((s) => ({
      url: s.url,
      title: s.title,
      snippet: s.snippet,
    }));

    // 4. Insert the turn into debate_turns table (let Postgres generate the UUID)
    const { data: turnData, error: turnError } = await this.supabase
      .from('debate_turns')
      .insert({
        debate_id: debate.id,
        agent_id: agent.id,
        turn_number: turnNumber,
        content: agentResponse.argument,
        research_sources: researchSources,
        citations,
      })
      .select()
      .single();

    if (turnError) {
      throw new Error(`Failed to insert debate turn: ${turnError.message}`);
    }

    const turn: DebateTurn = turnData as DebateTurn;

    // 5. Concurrently run FactCheckerAgent on the claims
    const factChecks = await this.runFactChecks(
      debate,
      agent,
      turn,
      agentResponse,
      researchResults
    );

    return { turn, factChecks };
  }

  /**
   * Run fact-checking on the claims from the agent's response.
   * If lies are detected, inserts them into fact_checks and lie_alerts tables.
   */
  private async runFactChecks(
    debate: Debate,
    agent: DebateAgent,
    turn: DebateTurn,
    agentResponse: AgentResponse,
    researchResults: ResearchResults
  ): Promise<FactCheckResult[]> {
    if (agentResponse.claims.length === 0) {
      console.log(`[TurnManager] No claims to fact-check, skipping`);
      return [];
    }

    const tFC = Date.now();
    console.log(`[TurnManager] Fact-checking ${agentResponse.claims.length} claims...`);

    const factChecker = new FactCheckerAgent(process.env.ANTHROPIC_API_KEY!);

    const factCheckResults = await factChecker.checkClaims({
      topic: debate.topic,
      argument: agentResponse.argument,
      claims: agentResponse.claims,
      researchContext: researchResults.combinedContext,
    });

    console.log(`[TurnManager] Fact-check API done (${Date.now() - tFC}ms), persisting ${factCheckResults.length} results...`);

    // Insert all fact check results in parallel
    await Promise.all(factCheckResults.map(async (fc) => {
      const { data: factCheckRow, error: fcError } = await this.supabase
        .from('fact_checks')
        .insert({
          debate_id: debate.id,
          turn_id: turn.id,
          agent_id: agent.id,
          claim_text: fc.claim_text,
          verdict: fc.verdict,
          explanation: fc.explanation,
          sources: fc.sources,
          confidence: fc.confidence,
          is_lie: fc.is_lie,
        })
        .select()
        .single();

      if (fcError) {
        console.error(`Failed to insert fact check for claim "${fc.claim_text}":`, fcError);
        return;
      }

      // If a lie is detected, create a lie alert
      if (fc.is_lie && factCheckRow) {
        const severity = fc.confidence >= 0.9 ? 'critical' : 'warning';

        const { error: alertError } = await this.supabase.from('lie_alerts').insert({
          debate_id: debate.id,
          fact_check_id: factCheckRow.id,
          agent_name: agent.name,
          claim_text: fc.claim_text,
          explanation: fc.explanation,
          severity,
        });

        if (alertError) {
          console.error(`Failed to insert lie alert for claim "${fc.claim_text}":`, alertError);
        }
      }
    }));

    return factCheckResults;
  }
}
