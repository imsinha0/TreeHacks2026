/**
 * Government API Client
 * 
 * This client provides a clean interface for interacting with government APIs.
 * Update the configuration to match your specific government API.
 */

// Configuration
const API_BASE_URL = process.env.GOVERNMENT_API_URL || 'https://api.example.gov/v1';
const API_KEY = process.env.GOVERNMENT_API_KEY;

export interface GovernmentApiResult {
  data: unknown;
  sources: Array<{
    url: string;
    title: string;
    snippet: string;
  }>;
}

export interface GovernmentApiOptions {
  query: string;
  limit?: number;
  filters?: Record<string, string>;
}

export class GovernmentApiClient {
  constructor(private apiKey?: string) {
    this.apiKey = apiKey || API_KEY;
  }

  /**
   * Search the government API for information
   */
  async search(options: GovernmentApiOptions): Promise<GovernmentApiResult> {
    const { query, limit = 10, filters = {} } = options;

    try {
      // Build the request URL
      const url = new URL(`${API_BASE_URL}/search`);
      url.searchParams.append('q', query);
      url.searchParams.append('limit', limit.toString());

      // Add any additional filters
      Object.entries(filters).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });

      // Prepare headers
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      // Add API key if available
      if (this.apiKey) {
        // Adjust header name based on your API requirements
        headers['X-API-Key'] = this.apiKey;
        // Alternative patterns:
        // headers['Authorization'] = `Bearer ${this.apiKey}`;
        // headers['Authorization'] = `API-Key ${this.apiKey}`;
      }

      // Make the request
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unable to read error');
        throw new Error(
          `Government API request failed with status ${response.status}: ${errorText}`
        );
      }

      const data = await response.json();

      // Transform the response to match our expected format
      // Adjust this based on your API's response structure
      const sources = this.extractSources(data);
      const answer = this.extractAnswer(data);

      return {
        data,
        sources,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('Government API request failed')) {
        throw error;
      }
      throw new Error(
        `Government API search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Extract sources from the API response
   * Adjust this method based on your API's response structure
   */
  private extractSources(data: unknown): GovernmentApiResult['sources'] {
    const sources: GovernmentApiResult['sources'] = [];

    // Example: Adjust based on your API's response structure
    if (typeof data === 'object' && data !== null) {
      const obj = data as Record<string, unknown>;

      // Pattern 1: Response has a 'results' array
      if (Array.isArray(obj.results)) {
        for (const item of obj.results) {
          if (typeof item === 'object' && item !== null) {
            const itemObj = item as Record<string, unknown>;
            sources.push({
              url: String(itemObj.url || itemObj.link || ''),
              title: String(itemObj.title || itemObj.name || 'Untitled'),
              snippet: String(itemObj.snippet || itemObj.description || itemObj.summary || ''),
            });
          }
        }
      }

      // Pattern 2: Response has a 'data' array
      if (Array.isArray(obj.data)) {
        for (const item of obj.data) {
          if (typeof item === 'object' && item !== null) {
            const itemObj = item as Record<string, unknown>;
            sources.push({
              url: String(itemObj.url || itemObj.link || ''),
              title: String(itemObj.title || itemObj.name || 'Untitled'),
              snippet: String(itemObj.snippet || itemObj.description || itemObj.summary || ''),
            });
          }
        }
      }
    }

    return sources;
  }

  /**
   * Extract answer/summary from the API response
   * Adjust this method based on your API's response structure
   */
  private extractAnswer(data: unknown): string {
    if (typeof data === 'object' && data !== null) {
      const obj = data as Record<string, unknown>;
      
      // Try common fields for summary/answer
      if (typeof obj.summary === 'string') return obj.summary;
      if (typeof obj.answer === 'string') return obj.answer;
      if (typeof obj.description === 'string') return obj.description;
      if (typeof obj.overview === 'string') return obj.overview;
    }

    return '';
  }

  /**
   * Get a specific document/resource by ID
   */
  async getDocument(id: string): Promise<unknown> {
    try {
      const url = new URL(`${API_BASE_URL}/documents/${id}`);

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (this.apiKey) {
        headers['X-API-Key'] = this.apiKey;
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unable to read error');
        throw new Error(
          `Government API request failed with status ${response.status}: ${errorText}`
        );
      }

      return await response.json();
    } catch (error) {
      throw new Error(
        `Failed to fetch document: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

