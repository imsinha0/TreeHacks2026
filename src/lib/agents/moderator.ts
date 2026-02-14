import Anthropic from '@anthropic-ai/sdk';
import { KeyArgument, FactCheckSummaryData, SourceUsed, VoteResults } from '@/types/debate';
import { getModeratorSystemPrompt } from './prompts/moderator-system';

const MODEL = 'claude-sonnet-4-5-20250929';

export interface ModerationSummary {
  overall_summary: string;
  winner_analysis: string;
  accuracy_scores: Record<string, number>;
  key_arguments: KeyArgument[];
  fact_check_summary: FactCheckSummaryData;
  sources_used: SourceUsed[];
  recommendations: string;
  vote_results: VoteResults | null;
}

export class ModeratorAgent {
  private client: Anthropic;

  constructor(private apiKey: string) {
    this.client = new Anthropic({ apiKey: this.apiKey });
  }

  async generateSummary(params: {
    topic: string;
    turns: Array<{ role: string; content: string; turn_number: number }>;
    factChecks: Array<{ claim_text: string; verdict: string; confidence: number }>;
    voteResults: { pro_count: number; con_count: number } | null;
  }): Promise<ModerationSummary> {
    const systemPrompt = getModeratorSystemPrompt(params.topic);

    const transcript = params.turns
      .sort((a, b) => a.turn_number - b.turn_number)
      .map(
        (turn) =>
          `[Turn ${turn.turn_number} - ${turn.role.toUpperCase()}]:\n${turn.content}`
      )
      .join('\n\n---\n\n');

    const factCheckSummary = params.factChecks
      .map(
        (fc) =>
          `- Claim: "${fc.claim_text}"\n  Verdict: ${fc.verdict} (confidence: ${fc.confidence})`
      )
      .join('\n');

    let voteInfo = 'No audience votes were cast.';
    if (params.voteResults) {
      const total = params.voteResults.pro_count + params.voteResults.con_count;
      if (total > 0) {
        const proPercent = ((params.voteResults.pro_count / total) * 100).toFixed(1);
        const conPercent = ((params.voteResults.con_count / total) * 100).toFixed(1);
        voteInfo = `Audience Vote Results:\n- Pro: ${params.voteResults.pro_count} votes (${proPercent}%)\n- Con: ${params.voteResults.con_count} votes (${conPercent}%)\n- Total: ${total} votes`;
      }
    }

    const userMessage = `## Full Debate Transcript

${transcript}

## Fact-Check Results

${factCheckSummary || 'No fact-checks were performed.'}

## Audience Votes

${voteInfo}

---

Analyze the entire debate and provide your comprehensive summary. Respond with valid JSON only.`;

    try {
      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userMessage,
          },
        ],
      });

      const rawText = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      return this.parseResponse(rawText, params.voteResults);
    } catch (error) {
      console.error('ModeratorAgent error:', error);
      throw new Error(
        `Failed to generate debate summary: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private parseResponse(
    rawText: string,
    voteResults: { pro_count: number; con_count: number } | null
  ): ModerationSummary {
    let parsed: Record<string, unknown>;

    try {
      parsed = JSON.parse(rawText);
    } catch {
      // Attempt to extract JSON from the response
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch {
          console.warn('ModeratorAgent: Failed to parse JSON response, returning fallback');
          return this.buildFallback(rawText, voteResults);
        }
      } else {
        console.warn('ModeratorAgent: No JSON found in response, returning fallback');
        return this.buildFallback(rawText, voteResults);
      }
    }

    return this.validateAndNormalize(parsed, voteResults);
  }

  private validateAndNormalize(
    parsed: Record<string, unknown>,
    voteResults: { pro_count: number; con_count: number } | null
  ): ModerationSummary {
    // Build vote_results
    let normalizedVoteResults: VoteResults | null = null;
    if (voteResults) {
      const total = voteResults.pro_count + voteResults.con_count;
      normalizedVoteResults = {
        pro_count: voteResults.pro_count,
        con_count: voteResults.con_count,
        total,
        pro_percentage: total > 0 ? (voteResults.pro_count / total) * 100 : 0,
        con_percentage: total > 0 ? (voteResults.con_count / total) * 100 : 0,
      };
    }

    // Parse accuracy_scores
    const rawScores = parsed.accuracy_scores;
    const accuracyScores: Record<string, number> = {};
    if (rawScores && typeof rawScores === 'object' && !Array.isArray(rawScores)) {
      for (const [key, value] of Object.entries(rawScores as Record<string, unknown>)) {
        accuracyScores[key] = typeof value === 'number' ? Math.max(0, Math.min(1, value)) : 0;
      }
    }

    // Parse key_arguments
    const keyArguments: KeyArgument[] = Array.isArray(parsed.key_arguments)
      ? parsed.key_arguments.map((arg: Record<string, unknown>) => ({
          agent_role: String(arg.agent_role ?? ''),
          argument: String(arg.argument ?? ''),
          strength: typeof arg.strength === 'number' ? Math.max(0, Math.min(1, arg.strength)) : 0,
          supported_by: Array.isArray(arg.supported_by)
            ? arg.supported_by.map((s: unknown) => String(s))
            : [],
        }))
      : [];

    // Parse fact_check_summary
    const rawFCS = parsed.fact_check_summary as Record<string, unknown> | undefined;
    const factCheckSummary: FactCheckSummaryData = {
      total_claims: typeof rawFCS?.total_claims === 'number' ? rawFCS.total_claims : 0,
      verified_true: typeof rawFCS?.verified_true === 'number' ? rawFCS.verified_true : 0,
      verified_false: typeof rawFCS?.verified_false === 'number' ? rawFCS.verified_false : 0,
      mixed: typeof rawFCS?.mixed === 'number' ? rawFCS.mixed : 0,
      unverifiable: typeof rawFCS?.unverifiable === 'number' ? rawFCS.unverifiable : 0,
    };

    // Parse sources_used
    const sourcesUsed: SourceUsed[] = Array.isArray(parsed.sources_used)
      ? parsed.sources_used.map((s: Record<string, unknown>) => ({
          url: String(s.url ?? ''),
          title: String(s.title ?? ''),
          cited_by: Array.isArray(s.cited_by)
            ? s.cited_by.map((c: unknown) => String(c))
            : [],
          reliability: typeof s.reliability === 'number' ? Math.max(0, Math.min(1, s.reliability)) : 0,
        }))
      : [];

    return {
      overall_summary: typeof parsed.overall_summary === 'string'
        ? parsed.overall_summary
        : String(parsed.overall_summary ?? ''),
      winner_analysis: typeof parsed.winner_analysis === 'string'
        ? parsed.winner_analysis
        : String(parsed.winner_analysis ?? ''),
      accuracy_scores: accuracyScores,
      key_arguments: keyArguments,
      fact_check_summary: factCheckSummary,
      sources_used: sourcesUsed,
      recommendations: typeof parsed.recommendations === 'string'
        ? parsed.recommendations
        : String(parsed.recommendations ?? ''),
      vote_results: normalizedVoteResults,
    };
  }

  private buildFallback(
    rawText: string,
    voteResults: { pro_count: number; con_count: number } | null
  ): ModerationSummary {
    let normalizedVoteResults: VoteResults | null = null;
    if (voteResults) {
      const total = voteResults.pro_count + voteResults.con_count;
      normalizedVoteResults = {
        pro_count: voteResults.pro_count,
        con_count: voteResults.con_count,
        total,
        pro_percentage: total > 0 ? (voteResults.pro_count / total) * 100 : 0,
        con_percentage: total > 0 ? (voteResults.con_count / total) * 100 : 0,
      };
    }

    return {
      overall_summary: rawText || 'Unable to generate debate summary due to a processing error.',
      winner_analysis: 'Analysis unavailable due to a processing error.',
      accuracy_scores: {},
      key_arguments: [],
      fact_check_summary: {
        total_claims: 0,
        verified_true: 0,
        verified_false: 0,
        mixed: 0,
        unverifiable: 0,
      },
      sources_used: [],
      recommendations: 'Unable to provide recommendations due to a processing error.',
      vote_results: normalizedVoteResults,
    };
  }
}
