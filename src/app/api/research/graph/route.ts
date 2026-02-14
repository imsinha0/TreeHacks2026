import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { traverseGraphForContext } from '@/lib/research/graph-traversal';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { debate_id, query, max_depth = 2 } = body;

    if (!debate_id || !query) {
      return NextResponse.json(
        { error: 'Missing debate_id or query parameter' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const context = await traverseGraphForContext(supabase, debate_id, query, max_depth);

    return NextResponse.json(context);
  } catch (error) {
    console.error('Graph traversal error:', error);
    return NextResponse.json(
      { error: 'Graph traversal failed' },
      { status: 500 }
    );
  }
}
