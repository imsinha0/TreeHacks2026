import Anthropic from '@anthropic-ai/sdk';
import { getFactCheckerSystemPrompt } from './prompts/factchecker-system';

const MODEL = 'claude-sonnet-4-5-20250929';

export interface FactCheckResult {
  claim_text: string;
  verdict: string;
  explanation: string;
  sources: Array<{ url: string; title: string; relevant_text: string }>;
  confidence: number;
  is_lie: boolean;
}

export class FactCheckerAgent {
  private client: Anthropic;

  constructor(private apiKey: string) {
    this.client = new Anthropic({ apiKey: this.apiKey });
  }

  async checkClaims(params: {
    topic: string;
    argument: string;
    claims: string[];
    researchContext: string;
  }): Promise<FactCheckResult[]> {
    if (params.claims.length === 0) {
      return [];
    }

    const systemPrompt = getFactCheckerSystemPrompt(params.topic);

    const claimsList = params.claims
      .map((claim, i) => `${i + 1}. "${claim}"`)
      .join('\n');

    const userMessage = `## Research Context & Source Documents

${params.researchContext}

## Argument Being Fact-Checked

${params.argument}

## Claims to Verify

${claimsList}

---

Evaluate each claim above against the research context and source documents. Respond with valid JSON only.`;

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

      return this.parseResponse(rawText, params.claims);
    } catch (error) {
      console.error('FactCheckerAgent error:', error);
      throw new Error(
        `Failed to fact-check claims: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private parseResponse(rawText: string, originalClaims: string[]): FactCheckResult[] {
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
          console.warn('FactCheckerAgent: Failed to parse JSON response, returning fallback');
          return this.buildFallbackResults(originalClaims);
        }
      } else {
        console.warn('FactCheckerAgent: No JSON found in response, returning fallback');
        return this.buildFallbackResults(originalClaims);
      }
    }

    const claims = Array.isArray(parsed.claims) ? parsed.claims : [];

    return claims.map((c: Record<string, unknown>) => {
      const verdict = this.normalizeVerdict(String(c.verdict ?? 'unverifiable'));
      const confidence = typeof c.confidence === 'number'
        ? Math.max(0, Math.min(1, c.confidence))
        : 0.5;

      const isLie = confidence >= 0.8 && (verdict === 'false' || verdict === 'mostly_false');

      return {
        claim_text: typeof c.claim_text === 'string' ? c.claim_text : String(c.claim_text ?? ''),
        verdict,
        explanation: typeof c.explanation === 'string' ? c.explanation : String(c.explanation ?? ''),
        sources: Array.isArray(c.sources)
          ? c.sources.map((s: Record<string, unknown>) => ({
              url: String(s.url ?? ''),
              title: String(s.title ?? ''),
              relevant_text: String(s.relevant_text ?? ''),
            }))
          : [],
        confidence,
        is_lie: isLie,
      };
    });
  }

  private normalizeVerdict(verdict: string): string {
    const validVerdicts = ['true', 'mostly_true', 'mixed', 'mostly_false', 'false', 'unverifiable'];
    const normalized = verdict.toLowerCase().trim();
    return validVerdicts.includes(normalized) ? normalized : 'unverifiable';
  }

  private buildFallbackResults(claims: string[]): FactCheckResult[] {
    return claims.map((claim) => ({
      claim_text: claim,
      verdict: 'unverifiable',
      explanation: 'Unable to verify this claim due to a processing error.',
      sources: [],
      confidence: 0,
      is_lie: false,
    }));
  }
}
