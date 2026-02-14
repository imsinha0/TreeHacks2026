import Anthropic from '@anthropic-ai/sdk';
import { AgentResponse } from '@/types/agent';
import { getDebaterSystemPrompt } from './prompts/debater-system';

const MODEL = 'claude-sonnet-4-5-20250929';

export class DebaterAgent {
  private client: Anthropic;

  constructor(
    private role: 'pro' | 'con',
    private apiKey: string
  ) {
    this.client = new Anthropic({ apiKey: this.apiKey });
  }

  async generateArgument(params: {
    topic: string;
    debateType: 'standard' | 'court_simulation';
    persona: string;
    previousTurns: Array<{ role: string; content: string }>;
    researchContext: string;
    documents: Array<{ id: string; title: string; summary: string; source_url: string }>;
  }): Promise<AgentResponse> {
    const systemPrompt = getDebaterSystemPrompt(
      this.role,
      params.topic,
      params.debateType,
      params.persona
    );

    const documentContext = params.documents
      .map(
        (doc) =>
          `[Document ID: ${doc.id}]\nTitle: ${doc.title}\nURL: ${doc.source_url}\nSummary: ${doc.summary}`
      )
      .join('\n\n');

    const turnHistory = params.previousTurns
      .map((turn) => `[${turn.role.toUpperCase()}]: ${turn.content}`)
      .join('\n\n---\n\n');

    const userMessage = `## Research Context

${params.researchContext}

## Available Documents

${documentContext || 'No documents provided.'}

## Debate History

${turnHistory || 'This is the opening statement. No previous turns.'}

---

Now present your argument for this turn. Remember to respond with valid JSON only.`;

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

      return this.parseResponse(rawText);
    } catch (error) {
      console.error(`DebaterAgent (${this.role}) error:`, error);
      throw new Error(
        `Failed to generate ${this.role} argument: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private parseResponse(rawText: string): AgentResponse {
    try {
      const parsed = JSON.parse(rawText);
      return this.validateAndNormalize(parsed);
    } catch {
      // Attempt to extract JSON from the response if it contains extra text
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          return this.validateAndNormalize(parsed);
        } catch {
          // Fall through to fallback
        }
      }

      // Fallback: return the raw text as the argument with empty structured data
      console.warn(`DebaterAgent (${this.role}): Failed to parse JSON response, using fallback`);
      return {
        argument: rawText,
        citations: [],
        claims: [],
        graph_nodes: [],
      };
    }
  }

  private validateAndNormalize(parsed: Record<string, unknown>): AgentResponse {
    return {
      argument: typeof parsed.argument === 'string' ? parsed.argument : String(parsed.argument ?? ''),
      citations: Array.isArray(parsed.citations)
        ? parsed.citations.map((c: Record<string, unknown>) => ({
            document_id: String(c.document_id ?? ''),
            label: String(c.label ?? ''),
            source_url: c.source_url != null ? String(c.source_url) : undefined,
          }))
        : [],
      claims: Array.isArray(parsed.claims)
        ? parsed.claims.map((c: unknown) => String(c))
        : [],
      graph_nodes: Array.isArray(parsed.graph_nodes)
        ? parsed.graph_nodes.map((n: Record<string, unknown>) => ({
            label: String(n.label ?? ''),
            node_type: (['claim', 'evidence', 'source'].includes(String(n.node_type))
              ? String(n.node_type)
              : 'claim') as 'claim' | 'evidence' | 'source',
            summary: String(n.summary ?? ''),
            source_url: n.source_url != null ? String(n.source_url) : undefined,
          }))
        : [],
    };
  }
}
