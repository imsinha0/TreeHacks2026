'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { GraphNode, GraphEdge } from '@/types/graph';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface UseKnowledgeGraphReturn {
  nodes: GraphNode[];
  edges: GraphEdge[];
  loading: boolean;
}

export function useKnowledgeGraph(debateId: string): UseKnowledgeGraphReturn {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInitialData = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);

    try {
      const [nodesRes, edgesRes] = await Promise.all([
        supabase
          .from('graph_nodes')
          .select('*')
          .eq('debate_id', debateId)
          .order('created_at', { ascending: true }),
        supabase
          .from('graph_edges')
          .select('*')
          .eq('debate_id', debateId)
          .order('created_at', { ascending: true }),
      ]);

      if (nodesRes.error) {
        console.error('Failed to fetch graph nodes:', nodesRes.error);
      } else {
        setNodes((nodesRes.data ?? []) as GraphNode[]);
      }

      if (edgesRes.error) {
        console.error('Failed to fetch graph edges:', edgesRes.error);
      } else {
        setEdges((edgesRes.data ?? []) as GraphEdge[]);
      }
    } catch (err) {
      console.error('useKnowledgeGraph fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [debateId]);

  useEffect(() => {
    fetchInitialData();

    const supabase = createClient();

    const channel = supabase
      .channel(`knowledge-graph-${debateId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'graph_nodes',
          filter: `debate_id=eq.${debateId}`,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const newNode = payload.new as GraphNode;
          setNodes((prev) => {
            if (prev.some((n) => n.id === newNode.id)) return prev;
            return [...prev, newNode];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'graph_nodes',
          filter: `debate_id=eq.${debateId}`,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const updatedNode = payload.new as GraphNode;
          setNodes((prev) =>
            prev.map((n) => (n.id === updatedNode.id ? updatedNode : n))
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'graph_edges',
          filter: `debate_id=eq.${debateId}`,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const newEdge = payload.new as GraphEdge;
          setEdges((prev) => {
            if (prev.some((e) => e.id === newEdge.id)) return prev;
            return [...prev, newEdge];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [debateId, fetchInitialData]);

  return { nodes, edges, loading };
}
