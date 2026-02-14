import { NextResponse } from 'next/server';
import { PerplexityClient } from '@/lib/research/perplexity';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { query, depth = 'standard' } = body;

    if (!query) {
      return NextResponse.json(
        { error: 'Missing query parameter' },
        { status: 400 }
      );
    }

    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Perplexity API key not configured' },
        { status: 500 }
      );
    }

    const client = new PerplexityClient(apiKey);
    const result = await client.search(query, depth);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Perplexity search error:', error);
    return NextResponse.json(
      { error: 'Research query failed' },
      { status: 500 }
    );
  }
}
