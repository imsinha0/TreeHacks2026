import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { node_id, action, agent_id, color } = body;

    if (!node_id || !action) {
      return NextResponse.json(
        { error: 'Missing node_id or action' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    if (action === 'highlight') {
      await supabase.rpc('highlight_cited_node', {
        p_node_id: node_id,
        p_agent_id: agent_id,
        p_color: color || '#FBBF24',
      });
      return NextResponse.json({ success: true });
    }

    if (action === 'clear_highlight') {
      await supabase
        .from('graph_nodes')
        .update({
          is_highlighted: false,
          highlight_color: null,
          highlighted_by_agent_id: null,
        })
        .eq('id', node_id);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: 'Unknown action. Valid actions: highlight, clear_highlight' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error updating graph:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
