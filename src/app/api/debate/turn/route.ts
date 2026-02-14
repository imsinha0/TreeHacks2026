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

    const { data: turns, error } = await supabase
      .from('debate_turns')
      .select('*')
      .eq('debate_id', debateId)
      .order('turn_number', { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch turns' },
        { status: 500 }
      );
    }

    return NextResponse.json(turns || []);
  } catch (error) {
    console.error('Error fetching turns:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
