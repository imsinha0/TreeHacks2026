'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { GraphNode, GraphEdge, NodeType, EDGE_STYLES } from '@/types/graph';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, ExternalLink, ArrowRight, Quote } from 'lucide-react';

interface NodeDetailPanelProps {
  nodeId: string | null;
  debateId: string;
  onClose: () => void;
  onJumpToTurn?: (turnNumber: number) => void;
}

interface ConnectedNodeInfo {
  id: string;
  label: string;
  node_type: NodeType;
  edgeType: string;
  edgeLabel: string;
  direction: 'incoming' | 'outgoing';
}

const NODE_TYPE_COLORS: Record<NodeType, string> = {
  document: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  claim: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  entity: 'bg-green-500/20 text-green-400 border-green-500/30',
  concept: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  evidence: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  source: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
};

export default function NodeDetailPanel({
  nodeId,
  debateId,
  onClose,
  onJumpToTurn,
}: NodeDetailPanelProps) {
  const [node, setNode] = useState<GraphNode | null>(null);
  const [connectedNodes, setConnectedNodes] = useState<ConnectedNodeInfo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!nodeId) {
      setNode(null);
      setConnectedNodes([]);
      return;
    }

    const fetchNodeDetails = async () => {
      setLoading(true);
      const supabase = createClient();

      // Fetch the node itself
      const { data: nodeData, error: nodeError } = await supabase
        .from('graph_nodes')
        .select('*')
        .eq('id', nodeId)
        .eq('debate_id', debateId)
        .single();

      if (nodeError || !nodeData) {
        console.error('Error fetching node:', nodeError);
        setLoading(false);
        return;
      }

      setNode(nodeData as GraphNode);

      // Fetch connected edges (both directions)
      const { data: outgoingEdges } = await supabase
        .from('graph_edges')
        .select('*')
        .eq('debate_id', debateId)
        .eq('source_node_id', nodeId);

      const { data: incomingEdges } = await supabase
        .from('graph_edges')
        .select('*')
        .eq('debate_id', debateId)
        .eq('target_node_id', nodeId);

      const connectedNodeIds = new Set<string>();
      const edgeInfoMap = new Map<
        string,
        { edgeType: string; edgeLabel: string; direction: 'incoming' | 'outgoing' }
      >();

      (outgoingEdges || []).forEach((edge: GraphEdge) => {
        connectedNodeIds.add(edge.target_node_id);
        edgeInfoMap.set(edge.target_node_id, {
          edgeType: edge.edge_type,
          edgeLabel: edge.label,
          direction: 'outgoing',
        });
      });

      (incomingEdges || []).forEach((edge: GraphEdge) => {
        connectedNodeIds.add(edge.source_node_id);
        edgeInfoMap.set(edge.source_node_id, {
          edgeType: edge.edge_type,
          edgeLabel: edge.label,
          direction: 'incoming',
        });
      });

      if (connectedNodeIds.size > 0) {
        const { data: connectedNodesData } = await supabase
          .from('graph_nodes')
          .select('id, label, node_type')
          .eq('debate_id', debateId)
          .in('id', Array.from(connectedNodeIds));

        const connected: ConnectedNodeInfo[] = (connectedNodesData || []).map(
          (cn: { id: string; label: string; node_type: NodeType }) => {
            const edgeInfo = edgeInfoMap.get(cn.id);
            return {
              id: cn.id,
              label: cn.label,
              node_type: cn.node_type,
              edgeType: edgeInfo?.edgeType || 'related_to',
              edgeLabel: edgeInfo?.edgeLabel || '',
              direction: edgeInfo?.direction || 'outgoing',
            };
          }
        );

        setConnectedNodes(connected);
      } else {
        setConnectedNodes([]);
      }

      setLoading(false);
    };

    fetchNodeDetails();
  }, [nodeId, debateId]);

  if (!nodeId) return null;

  const sourceUrl = node?.metadata?.source_url as string | undefined;
  const turnNumber = node?.metadata?.turn_number as number | undefined;

  return (
    <Card className="absolute right-4 top-4 z-10 w-80 border-border/50 bg-background/95 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate">
              {loading ? 'Loading...' : node?.title || 'Node Details'}
            </CardTitle>
            {node && (
              <CardDescription className="mt-1 flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={`text-[10px] ${NODE_TYPE_COLORS[node.node_type] || ''}`}
                >
                  {node.node_type}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  <Quote className="inline h-3 w-3 mr-0.5" />
                  {node.citation_count} citations
                </span>
              </CardDescription>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      {node && !loading && (
        <>
          <CardContent className="pb-3">
            <ScrollArea className="max-h-40">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {node.summary || 'No summary available.'}
              </p>
            </ScrollArea>

            {sourceUrl && (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                View source
              </a>
            )}

            {connectedNodes.length > 0 && (
              <div className="mt-4">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Connected Nodes ({connectedNodes.length})
                </h4>
                <ScrollArea className="max-h-32">
                  <div className="space-y-1.5">
                    {connectedNodes.map((cn) => {
                      const edgeStyle =
                        EDGE_STYLES[cn.edgeType as keyof typeof EDGE_STYLES];
                      return (
                        <div
                          key={cn.id}
                          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent/50 transition-colors"
                        >
                          <ArrowRight
                            className="h-3 w-3 shrink-0"
                            style={{
                              color: edgeStyle?.color || '#6B7280',
                              transform:
                                cn.direction === 'incoming'
                                  ? 'rotate(180deg)'
                                  : undefined,
                            }}
                          />
                          <Badge
                            variant="outline"
                            className={`text-[9px] shrink-0 ${NODE_TYPE_COLORS[cn.node_type] || ''}`}
                          >
                            {cn.node_type}
                          </Badge>
                          <span className="truncate text-foreground">
                            {cn.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}
          </CardContent>

          <CardFooter className="pt-0">
            {turnNumber !== undefined && onJumpToTurn && (
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => onJumpToTurn(turnNumber)}
              >
                Jump to Turn {turnNumber}
              </Button>
            )}
          </CardFooter>
        </>
      )}

      {loading && (
        <CardContent>
          <div className="flex items-center justify-center py-6">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        </CardContent>
      )}
    </Card>
  );
}
