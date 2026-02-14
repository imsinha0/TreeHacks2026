import { SupabaseClient } from '@supabase/supabase-js';
import type { NodeType, EdgeType, GraphNode, GraphEdge } from '@/types/graph';

export class GraphManager {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Create a new node in the knowledge graph.
   */
  async createNode(params: {
    debateId: string;
    documentId?: string;
    nodeType: NodeType;
    label: string;
    title: string;
    summary: string;
    metadata?: Record<string, unknown>;
    color?: string;
    size?: number;
  }): Promise<GraphNode> {
    const { data, error } = await this.supabase
      .from('graph_nodes')
      .insert({
        debate_id: params.debateId,
        document_id: params.documentId ?? null,
        node_type: params.nodeType,
        label: params.label,
        title: params.title,
        summary: params.summary,
        metadata: params.metadata ?? {},
        color: params.color ?? '#6B7280',
        size: params.size ?? 5,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create graph node: ${error.message}`);
    }

    return data as GraphNode;
  }

  /**
   * Create a new edge between two nodes in the knowledge graph.
   */
  async createEdge(params: {
    debateId: string;
    sourceNodeId: string;
    targetNodeId: string;
    edgeType: EdgeType;
    label?: string;
    weight?: number;
  }): Promise<GraphEdge> {
    const { data, error } = await this.supabase
      .from('graph_edges')
      .insert({
        debate_id: params.debateId,
        source_node_id: params.sourceNodeId,
        target_node_id: params.targetNodeId,
        edge_type: params.edgeType,
        label: params.label ?? '',
        weight: params.weight ?? 1.0,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create graph edge: ${error.message}`);
    }

    return data as GraphEdge;
  }

  /**
   * Highlight a node in the knowledge graph using the highlight_cited_node RPC.
   * Increments citation_count and increases node size.
   */
  async highlightNode(nodeId: string, agentId: string, color: string): Promise<void> {
    const { error } = await this.supabase.rpc('highlight_cited_node', {
      p_node_id: nodeId,
      p_agent_id: agentId,
      p_color: color,
    });

    if (error) {
      throw new Error(`Failed to highlight node ${nodeId}: ${error.message}`);
    }
  }

  /**
   * Clear the highlight from a node.
   */
  async clearHighlight(nodeId: string): Promise<void> {
    const { error } = await this.supabase
      .from('graph_nodes')
      .update({
        is_highlighted: false,
        highlight_color: null,
        highlighted_by_agent_id: null,
      })
      .eq('id', nodeId);

    if (error) {
      throw new Error(`Failed to clear highlight on node ${nodeId}: ${error.message}`);
    }
  }

  /**
   * Fetch all nodes and edges for a debate.
   */
  async getGraphData(debateId: string): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
    const [nodesResult, edgesResult] = await Promise.all([
      this.supabase
        .from('graph_nodes')
        .select('*')
        .eq('debate_id', debateId)
        .order('created_at', { ascending: true }),
      this.supabase
        .from('graph_edges')
        .select('*')
        .eq('debate_id', debateId)
        .order('created_at', { ascending: true }),
    ]);

    if (nodesResult.error) {
      throw new Error(`Failed to fetch graph nodes: ${nodesResult.error.message}`);
    }
    if (edgesResult.error) {
      throw new Error(`Failed to fetch graph edges: ${edgesResult.error.message}`);
    }

    return {
      nodes: (nodesResult.data ?? []) as GraphNode[],
      edges: (edgesResult.data ?? []) as GraphEdge[],
    };
  }

  /**
   * Get a single node along with all edges connected to it (as source or target).
   */
  async getNodeWithDetails(nodeId: string): Promise<GraphNode & { edges: GraphEdge[] }> {
    const { data: node, error: nodeError } = await this.supabase
      .from('graph_nodes')
      .select('*')
      .eq('id', nodeId)
      .single();

    if (nodeError) {
      throw new Error(`Failed to fetch node ${nodeId}: ${nodeError.message}`);
    }

    const { data: edges, error: edgesError } = await this.supabase
      .from('graph_edges')
      .select('*')
      .or(`source_node_id.eq.${nodeId},target_node_id.eq.${nodeId}`);

    if (edgesError) {
      throw new Error(`Failed to fetch edges for node ${nodeId}: ${edgesError.message}`);
    }

    return {
      ...(node as GraphNode),
      edges: (edges ?? []) as GraphEdge[],
    };
  }
}
