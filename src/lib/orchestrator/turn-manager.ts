import { SupabaseClient } from '@supabase/supabase-js';
import { Debate, DebateTurn, Citation, TurnType } from '@/types/debate';
import { DebateAgent, AgentResponse } from '@/types/agent';
import { ResearchResults } from '@/lib/research/parallel-research';
import { DebaterAgent } from '../agents/debater';
import { FactCheckerAgent, FactCheckResult } from '../agents/fact-checker';
import { TTSClient } from '../media/tts';

interface Document {
  id: string;
  title: string;
  summary: string;
  source_url: string;
}

/** Data produced by generateTurn(), ready to be persisted. */
export interface GeneratedTurnData {
  debate: Debate;
  agent: DebateAgent;
  turnNumber: number;
  turnType: TurnType;
  agentResponse: AgentResponse;
  citations: Citation[];
  researchSources: Array<{ url: string; title: string; snippet: string }>;
  audioUrl: string | null;
  researchResults: ResearchResults;
}

/**
 * Estimate the display/speech time for content based on word count.
 * ~150 words per minute, minimum 15 seconds.
 */
export function estimateDisplayTime(content: string): number {
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  return Math.max((wordCount / 150) * 60 * 1000, 15000);
}

export class TurnManager {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Original processTurn: generate + persist in one call. Kept for backwards compat.
   */
  async processTurn(params: {
    debate: Debate;
    agent: DebateAgent;
    turnNumber: number;
    turnType?: TurnType;
    previousTurns: DebateTurn[];
    researchResults: ResearchResults;
    documents: Document[];
  }): Promise<{ turn: DebateTurn; factChecks: FactCheckResult[] }> {
    const generated = await this.generateTurn(params);
    return this.persistTurn(generated);
  }

  /**
   * Generate a turn (Claude + TTS) WITHOUT persisting to DB.
   * Returns all data needed for persistTurn().
   */
  async generateTurn(params: {
    debate: Debate;
    agent: DebateAgent;
    turnNumber: number;
    turnType?: TurnType;
    previousTurns: DebateTurn[];
    researchResults: ResearchResults;
    documents: Document[];
  }): Promise<GeneratedTurnData> {
    const { debate, agent, turnNumber, turnType, previousTurns, researchResults, documents } = params;

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
      turnType,
    });

    console.log(`[TurnManager] Turn ${turnNumber}: debater done (${Date.now() - tDebater}ms), ${agentResponse.claims.length} claims`);

    // 2. Build citations
    const citations: Citation[] = agentResponse.citations.map((c) => ({
      label: c.label,
      source_url: c.source_url,
    }));

    // 3. Build research sources
    const researchSources = researchResults.sources.map((s) => ({
      url: s.url,
      title: s.title,
      snippet: s.snippet,
    }));

    // 4. Generate TTS audio
    let audioUrl: string | null = null;
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (openaiApiKey) {
      try {
        const tTTS = Date.now();
        const ttsClient = new TTSClient(openaiApiKey);
        const validVoices = ['alloy', 'echo', 'nova', 'shimmer'] as const;
        const voice = validVoices.includes(agent.voice_id as typeof validVoices[number])
          ? (agent.voice_id as typeof validVoices[number])
          : 'alloy';

        const audioBuffer = await ttsClient.synthesize({
          text: agentResponse.argument,
          voice,
        });

        // Upload to Supabase Storage
        const filePath = `${debate.id}/turn-${turnNumber}.mp3`;
        const { error: uploadError } = await this.supabase.storage
          .from('debate-audio')
          .upload(filePath, audioBuffer, {
            contentType: 'audio/mpeg',
            upsert: true,
          });

        if (!uploadError) {
          const { data: publicUrlData } = this.supabase.storage
            .from('debate-audio')
            .getPublicUrl(filePath);
          audioUrl = publicUrlData.publicUrl;
        } else {
          console.error(`[TurnManager] Failed to upload TTS audio:`, uploadError);
        }
        console.log(`[TurnManager] TTS done (${Date.now() - tTTS}ms)`);
      } catch (ttsError) {
        console.error(`[TurnManager] TTS generation failed:`, ttsError);
      }
    }

    return {
      debate,
      agent,
      turnNumber,
      turnType: turnType ?? 'rebuttal',
      agentResponse,
      citations,
      researchSources,
      audioUrl,
      researchResults,
    };
  }

  /**
   * Persist a generated turn to the DB. This triggers Supabase Realtime.
   */
  async persistTurn(data: GeneratedTurnData): Promise<{ turn: DebateTurn; factChecks: FactCheckResult[] }> {
    const { debate, agent, turnNumber, turnType, agentResponse, citations, researchSources, audioUrl, researchResults } = data;

    // Insert the turn into debate_turns table
    const { data: turnData, error: turnError } = await this.supabase
      .from('debate_turns')
      .insert({
        debate_id: debate.id,
        agent_id: agent.id,
        turn_number: turnNumber,
        turn_type: turnType,
        content: agentResponse.argument,
        research_sources: researchSources,
        citations,
        audio_url: audioUrl,
      })
      .select()
      .single();

    if (turnError) {
      throw new Error(`Failed to insert debate turn: ${turnError.message}`);
    }

    const turn: DebateTurn = turnData as DebateTurn;

    // Run fact-checking (this also persists fact checks and lie alerts)
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
