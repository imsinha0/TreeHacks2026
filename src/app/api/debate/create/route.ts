import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      topic,
      description,
      debateType,
      maxTurns,
      researchDepth,
      voiceEnabled,
      proAgent,
      conAgent,
    } = body;

    if (!topic || !debateType || !proAgent || !conAgent) {
      return NextResponse.json(
        { error: 'Missing required fields: topic, debateType, proAgent, conAgent' },
        { status: 400 }
      );
    }

    // Validate Supabase configuration
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing Supabase environment variables');
      return NextResponse.json(
        { error: 'Server configuration error: Missing Supabase credentials' },
        { status: 500 }
      );
    }

    const supabase = createServerClient();

    // Build debate config
    const config = {
      maxTurns: maxTurns ?? 5,
      turnTimeLimitSec: 120,
      researchDepth: researchDepth ?? 'standard',
      voiceEnabled: voiceEnabled ?? false,
      debateType,
    };

    // Insert the debate record
    const { data: debate, error: debateError } = await supabase
      .from('debates')
      .insert({
        topic,
        description: description ?? '',
        status: 'setup',
        config,
      })
      .select('id')
      .single();

    if (debateError || !debate) {
      console.error('Failed to create debate:', debateError);
      return NextResponse.json(
        { 
          error: 'Failed to create debate',
          details: debateError?.message || 'Unknown error',
          hint: debateError?.code === 'PGRST116' 
            ? 'Database tables may not exist. Please run Supabase migrations.'
            : debateError?.code === '42P01'
            ? 'Table does not exist. Please run Supabase migrations.'
            : undefined
        },
        { status: 500 }
      );
    }

    // Create the four debate agents
    const agents = [
      {
        debate_id: debate.id,
        role: 'pro',
        name: proAgent.name ?? 'Pro Agent',
        persona_description: proAgent.persona ?? '',
        voice_id: proAgent.voice ?? 'alloy',
        system_prompt: '',
      },
      {
        debate_id: debate.id,
        role: 'con',
        name: conAgent.name ?? 'Con Agent',
        persona_description: conAgent.persona ?? '',
        voice_id: conAgent.voice ?? 'echo',
        system_prompt: '',
      },
      {
        debate_id: debate.id,
        role: 'fact_checker',
        name: 'Fact Checker',
        persona_description: 'An impartial fact-checking agent that verifies claims made during the debate.',
        voice_id: 'nova',
        system_prompt: '',
      },
      {
        debate_id: debate.id,
        role: 'moderator',
        name: 'Moderator',
        persona_description: 'A neutral moderator that guides the debate and ensures fair discussion.',
        voice_id: 'shimmer',
        system_prompt: '',
      },
    ];

    const { error: agentsError } = await supabase
      .from('debate_agents')
      .insert(agents);

    if (agentsError) {
      console.error('Failed to create debate agents:', agentsError);
      // Clean up the debate record since agents failed
      await supabase.from('debates').delete().eq('id', debate.id);
      return NextResponse.json(
        { 
          error: 'Failed to create debate agents',
          details: agentsError?.message || 'Unknown error',
          hint: agentsError?.code === 'PGRST116' || agentsError?.code === '42P01'
            ? 'Database tables may not exist. Please run Supabase migrations.'
            : undefined
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ id: debate.id });
  } catch (error) {
    console.error('Error in debate creation:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}
