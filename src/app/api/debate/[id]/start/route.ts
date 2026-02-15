import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { DebateOrchestrator } from '@/lib/orchestrator/debate-orchestrator';
import { conductParallelResearch } from '@/lib/research/parallel-research';

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
      .select('*')
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

    // Kick off research immediately (before orchestrator loads data)
    const config = debate.config as { researchDepth?: string } | undefined;
    const researchDepth = (config?.researchDepth ?? 'standard') as 'quick' | 'standard' | 'deep';

    const researchPromise = Promise.all([
      conductParallelResearch({
        topic: debate.topic,
        role: 'pro',
        debateId: id,
        researchDepth,
        supabase,
        perplexityApiKey: process.env.PERPLEXITY_API_KEY!,
        openaiApiKey: process.env.OPENAI_API_KEY!,
      }),
      conductParallelResearch({
        topic: debate.topic,
        role: 'con',
        debateId: id,
        researchDepth,
        supabase,
        perplexityApiKey: process.env.PERPLEXITY_API_KEY!,
        openaiApiKey: process.env.OPENAI_API_KEY!,
      }),
    ]);

    // Trigger orchestrator asynchronously with pre-started research
    const orchestrator = new DebateOrchestrator(supabase);
    orchestrator.runDebate(id, researchPromise).catch((err) => {
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
