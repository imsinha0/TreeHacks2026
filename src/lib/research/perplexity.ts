export interface PerplexityResult {
  answer: string;
  sources: Array<{ url: string; title: string; snippet: string }>;
}

interface PerplexityMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface PerplexityCitation {
  url?: string;
  title?: string;
  snippet?: string;
  text?: string;
}

interface PerplexityResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  citations?: PerplexityCitation[];
}

const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

export class PerplexityClient {
  constructor(private apiKey: string) {}

  async search(
    query: string,
    depth: 'quick' | 'standard' | 'deep'
  ): Promise<PerplexityResult> {
    const model = depth === 'quick' ? 'sonar' : 'sonar-pro';

    const systemMessage = this.buildSystemMessage(depth);

    const messages: PerplexityMessage[] = [
      { role: 'system', content: systemMessage },
      { role: 'user', content: query },
    ];

    try {
      const response = await fetch(PERPLEXITY_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: depth === 'deep' ? 4096 : depth === 'standard' ? 2048 : 1024,
          temperature: 0.2,
          return_citations: true,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Unable to read error body');
        throw new Error(
          `Perplexity API request failed with status ${response.status}: ${errorBody}`
        );
      }

      const data: PerplexityResponse = await response.json();

      const answer =
        data.choices?.[0]?.message?.content ?? '';

      const sources = this.extractSources(data);

      return { answer, sources };
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Perplexity API request failed')) {
        throw error;
      }
      throw new Error(
        `Perplexity search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private buildSystemMessage(depth: 'quick' | 'standard' | 'deep'): string {
    const base =
      'You are a research assistant providing well-sourced, factual information for a debate platform.';

    if (depth === 'quick') {
      return `${base} Provide a concise summary with key facts and statistics.`;
    }
    if (depth === 'standard') {
      return `${base} Provide a thorough analysis with multiple perspectives, key statistics, and expert opinions.`;
    }
    // deep
    return `${base} Provide an exhaustive, deeply researched analysis. Include historical context, multiple expert viewpoints, statistical evidence, counterarguments, and nuanced perspectives. Be comprehensive.`;
  }

  private extractSources(data: PerplexityResponse): PerplexityResult['sources'] {
    const sources: PerplexityResult['sources'] = [];

    if (data.citations && Array.isArray(data.citations)) {
      for (const citation of data.citations) {
        // Citations can be returned as strings (just URLs) or objects
        if (typeof citation === 'string') {
          sources.push({
            url: citation,
            title: citation,
            snippet: '',
          });
        } else {
          sources.push({
            url: citation.url ?? '',
            title: citation.title ?? citation.url ?? 'Unknown source',
            snippet: citation.snippet ?? citation.text ?? '',
          });
        }
      }
    }

    return sources;
  }
}
