import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const debateId = searchParams.get('debate_id');

    if (!debateId) {
      return NextResponse.json(
        { error: 'Missing debate_id parameter' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const { data: edges, error } = await supabase
      .from('graph_edges')
      .select('*')
      .eq('debate_id', debateId)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch edges' },
        { status: 500 }
      );
    }

    return NextResponse.json(edges || []);
  } catch (error) {
    console.error('Error fetching graph edges:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
