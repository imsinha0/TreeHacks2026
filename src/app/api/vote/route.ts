import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { debate_id, voter_session_id, vote } = body;

    if (!debate_id || !voter_session_id || !vote) {
      return NextResponse.json(
        { error: 'Missing required fields: debate_id, voter_session_id, vote' },
        { status: 400 }
      );
    }

    if (vote !== 'pro' && vote !== 'con') {
      return NextResponse.json(
        { error: 'Vote must be either "pro" or "con"' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Upsert the vote on debate_id + voter_session_id
    const { error: voteError } = await supabase
      .from('debate_votes')
      .upsert(
        {
          debate_id,
          voter_session_id,
          vote,
        },
        {
          onConflict: 'debate_id,voter_session_id',
        }
      );

    if (voteError) {
      console.error('Failed to record vote:', voteError);
      return NextResponse.json(
        { error: 'Failed to record vote' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error recording vote:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const debate_id = searchParams.get('debate_id');

    if (!debate_id) {
      return NextResponse.json(
        { error: 'Missing required query parameter: debate_id' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Fetch all votes for this debate
    const { data: votes, error: votesError } = await supabase
      .from('debate_votes')
      .select('vote')
      .eq('debate_id', debate_id);

    if (votesError) {
      console.error('Failed to fetch votes:', votesError);
      return NextResponse.json(
        { error: 'Failed to fetch votes' },
        { status: 500 }
      );
    }

    const pro_count = votes?.filter((v) => v.vote === 'pro').length ?? 0;
    const con_count = votes?.filter((v) => v.vote === 'con').length ?? 0;
    const total = pro_count + con_count;
    const pro_percentage = total > 0 ? Math.round((pro_count / total) * 100) : 0;
    const con_percentage = total > 0 ? Math.round((con_count / total) * 100) : 0;

    return NextResponse.json({
      pro_count,
      con_count,
      total,
      pro_percentage,
      con_percentage,
    });
  } catch (error) {
    console.error('Error fetching votes:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
