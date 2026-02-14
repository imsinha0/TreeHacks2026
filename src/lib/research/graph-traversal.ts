import { SupabaseClient } from '@supabase/supabase-js';

export interface GraphContext {
  relevantNodes: Array<{
    id: string;
    label: string;
    summary: string;
    node_type: string;
  }>;
  relevantEdges: Array<{
    source_label: string;
    target_label: string;
    edge_type: string;
  }>;
  contextSummary: string;
}

interface GraphNodeRow {
  id: string;
  label: string;
  summary: string;
  node_type: string;
}

interface GraphEdgeRow {
  id: string;
  source_node_id: string;
  target_node_id: string;
  edge_type: string;
}

/**
 * Traverse the knowledge graph starting from nodes matching the query,
 * expanding outward up to maxDepth hops to gather relevant context.
 */
export async function traverseGraphForContext(
  supabase: SupabaseClient,
  debateId: string,
  query: string,
  maxDepth: number = 2
): Promise<GraphContext> {
  try {
    // Step 1: Find seed nodes that match the query by searching labels and summaries
    const seedNodes = await findSeedNodes(supabase, debateId, query);

    if (seedNodes.length === 0) {
      return {
        relevantNodes: [],
        relevantEdges: [],
        contextSummary: 'No relevant nodes found in the knowledge graph.',
      };
    }

    // Step 2: BFS traversal from seed nodes up to maxDepth
    const visitedNodeIds = new Set<string>(seedNodes.map((n) => n.id));
    const allNodes: Map<string, GraphNodeRow> = new Map();
    const allEdges: Array<{
      source_label: string;
      target_label: string;
      edge_type: string;
    }> = [];

    for (const node of seedNodes) {
      allNodes.set(node.id, node);
    }

    let frontier = seedNodes.map((n) => n.id);

    for (let depth = 0; depth < maxDepth && frontier.length > 0; depth++) {
      const { neighborNodes, edges } = await expandFrontier(
        supabase,
        debateId,
        frontier,
        allNodes
      );

      allEdges.push(...edges);

      const nextFrontier: string[] = [];
      for (const node of neighborNodes) {
        if (!visitedNodeIds.has(node.id)) {
          visitedNodeIds.add(node.id);
          allNodes.set(node.id, node);
          nextFrontier.push(node.id);
        }
      }

      frontier = nextFrontier;
    }

    const relevantNodes = Array.from(allNodes.values()).map((n) => ({
      id: n.id,
      label: n.label,
      summary: n.summary,
      node_type: n.node_type,
    }));

    const contextSummary = buildContextSummary(relevantNodes, allEdges);

    return {
      relevantNodes,
      relevantEdges: allEdges,
      contextSummary,
    };
  } catch (error) {
    console.error('Graph traversal error:', error);
    throw new Error(
      `Graph traversal failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Find initial seed nodes by matching the query against node labels and summaries.
 * Uses Postgres text search (ILIKE) to find relevant starting points.
 */
async function findSeedNodes(
  supabase: SupabaseClient,
  debateId: string,
  query: string
): Promise<GraphNodeRow[]> {
  // Extract meaningful keywords from the query (words with 3+ chars)
  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length >= 3)
    .slice(0, 10); // Limit to 10 keywords

  if (keywords.length === 0) {
    return [];
  }

  // Build OR conditions: match any keyword in label or summary
  const orConditions = keywords
    .map((kw) => `label.ilike.%${kw}%,summary.ilike.%${kw}%`)
    .join(',');

  const { data, error } = await supabase
    .from('graph_nodes')
    .select('id, label, summary, node_type')
    .eq('debate_id', debateId)
    .or(orConditions)
    .limit(20);

  if (error) {
    console.error('Error finding seed nodes:', error);
    return [];
  }

  return (data ?? []) as GraphNodeRow[];
}

/**
 * Expand the current frontier by finding all edges connected to frontier nodes,
 * then fetching the neighbor nodes on the other side of those edges.
 */
async function expandFrontier(
  supabase: SupabaseClient,
  debateId: string,
  frontierIds: string[],
  existingNodes: Map<string, GraphNodeRow>
): Promise<{
  neighborNodes: GraphNodeRow[];
  edges: Array<{ source_label: string; target_label: string; edge_type: string }>;
}> {
  if (frontierIds.length === 0) {
    return { neighborNodes: [], edges: [] };
  }

  // Find edges where frontier nodes are either source or target
  const [outgoingResult, incomingResult] = await Promise.all([
    supabase
      .from('graph_edges')
      .select('id, source_node_id, target_node_id, edge_type')
      .eq('debate_id', debateId)
      .in('source_node_id', frontierIds)
      .limit(100),
    supabase
      .from('graph_edges')
      .select('id, source_node_id, target_node_id, edge_type')
      .eq('debate_id', debateId)
      .in('target_node_id', frontierIds)
      .limit(100),
  ]);

  const allEdgeRows: GraphEdgeRow[] = [
    ...((outgoingResult.data ?? []) as GraphEdgeRow[]),
    ...((incomingResult.data ?? []) as GraphEdgeRow[]),
  ];

  // Deduplicate edges by id
  const uniqueEdges = new Map<string, GraphEdgeRow>();
  for (const edge of allEdgeRows) {
    uniqueEdges.set(edge.id, edge);
  }

  // Collect neighbor node IDs that we haven't seen yet
  const neighborIds = new Set<string>();
  for (const edge of Array.from(uniqueEdges.values())) {
    if (!existingNodes.has(edge.source_node_id)) {
      neighborIds.add(edge.source_node_id);
    }
    if (!existingNodes.has(edge.target_node_id)) {
      neighborIds.add(edge.target_node_id);
    }
  }

  // Fetch neighbor nodes
  let neighborNodes: GraphNodeRow[] = [];
  if (neighborIds.size > 0) {
    const { data, error } = await supabase
      .from('graph_nodes')
      .select('id, label, summary, node_type')
      .in('id', Array.from(neighborIds));

    if (error) {
      console.error('Error fetching neighbor nodes:', error);
    } else {
      neighborNodes = (data ?? []) as GraphNodeRow[];
    }
  }

  // Build a combined node map for label resolution
  const nodeMap = new Map(existingNodes);
  for (const node of neighborNodes) {
    nodeMap.set(node.id, node);
  }

  // Build edge labels
  const edges = Array.from(uniqueEdges.values()).map((edge) => ({
    source_label: nodeMap.get(edge.source_node_id)?.label ?? 'Unknown',
    target_label: nodeMap.get(edge.target_node_id)?.label ?? 'Unknown',
    edge_type: edge.edge_type,
  }));

  return { neighborNodes, edges };
}

/**
 * Build a human-readable context summary from traversed nodes and edges.
 */
function buildContextSummary(
  nodes: Array<{ id: string; label: string; summary: string; node_type: string }>,
  edges: Array<{ source_label: string; target_label: string; edge_type: string }>
): string {
  if (nodes.length === 0) {
    return 'No relevant context found in the knowledge graph.';
  }

  const sections: string[] = [];

  // Group nodes by type
  const nodesByType = new Map<string, typeof nodes>();
  for (const node of nodes) {
    const group = nodesByType.get(node.node_type) ?? [];
    group.push(node);
    nodesByType.set(node.node_type, group);
  }

  sections.push(`## Knowledge Graph Context (${nodes.length} nodes, ${edges.length} relationships)`);

  for (const [nodeType, typeNodes] of Array.from(nodesByType.entries())) {
    sections.push(`\n### ${nodeType.charAt(0).toUpperCase() + nodeType.slice(1)}s`);
    for (const node of typeNodes) {
      const summary = node.summary ? `: ${node.summary}` : '';
      sections.push(`- **${node.label}**${summary}`);
    }
  }

  if (edges.length > 0) {
    sections.push('\n### Relationships');
    // Deduplicate edge descriptions
    const edgeDescriptions = new Set<string>();
    for (const edge of edges) {
      const desc = `- ${edge.source_label} --[${edge.edge_type}]--> ${edge.target_label}`;
      edgeDescriptions.add(desc);
    }
    sections.push(...Array.from(edgeDescriptions));
  }

  return sections.join('\n');
}
