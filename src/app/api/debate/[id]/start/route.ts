import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { DebateOrchestrator } from '@/lib/orchestrator/debate-orchestrator';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Missing debate ID' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Verify the debate exists and is in a valid state to start
    const { data: debate, error: fetchError } = await supabase
      .from('debates')
      .select('id, status')
      .eq('id', id)
      .single();

    if (fetchError || !debate) {
      return NextResponse.json(
        { error: 'Debate not found' },
        { status: 404 }
      );
    }

    if (debate.status !== 'setup') {
      return NextResponse.json(
        { error: `Debate cannot be started from status: ${debate.status}` },
        { status: 400 }
      );
    }

    // Update debate status to 'researching'
    const { error: updateError } = await supabase
      .from('debates')
      .update({ status: 'researching' })
      .eq('id', id);

    if (updateError) {
      console.error('Failed to start debate:', updateError);
      return NextResponse.json(
        { error: 'Failed to start debate' },
        { status: 500 }
      );
    }

    // Trigger orchestrator asynchronously (don't await - it runs the full debate)
    const orchestrator = new DebateOrchestrator(supabase);
    orchestrator.runDebate(id).catch((err) => {
      console.error('Orchestrator error for debate', id, err);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error starting debate:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
