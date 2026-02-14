'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

interface GraphHighlighterProps {
  debateId: string;
  onHighlight: (nodeId: string) => void;
  onClearHighlight: (nodeId: string) => void;
}

export default function GraphHighlighter({
  debateId,
  onHighlight,
  onClearHighlight,
}: GraphHighlighterProps) {
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`graph-highlights-${debateId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'graph_nodes',
          filter: `debate_id=eq.${debateId}`,
        },
        (payload) => {
          const newRecord = payload.new as {
            id: string;
            is_highlighted: boolean;
          };

          if (!newRecord.is_highlighted) return;

          const nodeId = newRecord.id;

          // Call the highlight callback
          onHighlight(nodeId);

          // Clear any existing timer for this node
          const existingTimer = timersRef.current.get(nodeId);
          if (existingTimer) {
            clearTimeout(existingTimer);
          }

          // Set a timer to clear the highlight after 8 seconds
          const timer = setTimeout(async () => {
            onClearHighlight(nodeId);

            // Update Supabase to clear the highlight
            await supabase
              .from('graph_nodes')
              .update({
                is_highlighted: false,
                highlight_color: null,
                highlighted_by_agent_id: null,
              })
              .eq('id', nodeId)
              .eq('debate_id', debateId);

            timersRef.current.delete(nodeId);
          }, 8000);

          timersRef.current.set(nodeId, timer);
        }
      )
      .subscribe();

    const timers = timersRef.current;
    return () => {
      // Clean up all timers
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();

      // Unsubscribe from channel
      supabase.removeChannel(channel);
    };
  }, [debateId, onHighlight, onClearHighlight]);

  // This component renders nothing
  return null;
}
