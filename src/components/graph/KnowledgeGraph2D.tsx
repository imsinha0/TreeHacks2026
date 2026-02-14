'use client';

import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useKnowledgeGraph } from '@/hooks/useKnowledgeGraph';
import {
  GraphNodeDisplay,
  GraphEdgeDisplay,
  EDGE_STYLES,
  EdgeType,
} from '@/types/graph';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
});

interface KnowledgeGraph2DProps {
  debateId: string;
  onNodeClick?: (nodeId: string) => void;
  highlightedNodeId?: string | null;
}

export default function KnowledgeGraph2D({
  debateId,
  onNodeClick,
  highlightedNodeId,
}: KnowledgeGraph2DProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { nodes, edges, loading } = useKnowledgeGraph(debateId);

  const graphData = useMemo(() => {
    const displayNodes: GraphNodeDisplay[] = nodes.map((node) => ({
      id: node.id,
      label: node.label,
      title: node.title,
      summary: node.summary,
      nodeType: node.node_type,
      color: node.color,
      size: node.size,
      isHighlighted: node.is_highlighted || node.id === highlightedNodeId,
      highlightColor: node.highlight_color,
      citationCount: node.citation_count,
    }));

    const displayLinks: GraphEdgeDisplay[] = edges.map((edge) => ({
      source: edge.source_node_id,
      target: edge.target_node_id,
      edgeType: edge.edge_type,
      label: edge.label,
      weight: edge.weight,
    }));

    return { nodes: displayNodes, links: displayLinks };
  }, [nodes, edges, highlightedNodeId]);

  // Auto-pan to highlighted node
  useEffect(() => {
    if (!highlightedNodeId || !graphRef.current) return;

    const node = graphData.nodes.find((n) => n.id === highlightedNodeId);
    if (node && node.x !== undefined && node.y !== undefined) {
      graphRef.current.centerAt(node.x, node.y, 1000);
    }
  }, [highlightedNodeId, graphData.nodes]);

  const handleNodeClick = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node: any) => {
      if (onNodeClick && node.id) {
        onNodeClick(node.id as string);
      }
    },
    [onNodeClick]
  );

  const nodeCanvasObject = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const displayNode = node as GraphNodeDisplay & { x: number; y: number };
      const { x, y, label, color, size, isHighlighted, highlightColor } =
        displayNode;

      const radius = Math.sqrt(size || 4) * 2;
      const fontSize = Math.max(10 / globalScale, 1.5);

      // Draw highlight glow ring if highlighted
      if (isHighlighted) {
        ctx.beginPath();
        ctx.arc(x, y, radius + 3, 0, 2 * Math.PI);
        ctx.fillStyle = 'transparent';
        ctx.fill();
        ctx.strokeStyle = highlightColor || '#FBBF24';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = highlightColor || '#FBBF24';
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Draw node circle
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = color || '#6B7280';
      ctx.fill();
      ctx.strokeStyle = isHighlighted
        ? highlightColor || '#FBBF24'
        : 'rgba(255,255,255,0.2)';
      ctx.lineWidth = isHighlighted ? 1.5 : 0.5;
      ctx.stroke();

      // Draw label text below node
      ctx.font = `${fontSize}px Sans-Serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';

      const truncatedLabel =
        label.length > 24 ? label.substring(0, 22) + '...' : label;
      ctx.fillText(truncatedLabel, x, y + radius + 2);
    },
    []
  );

  const linkColor = useCallback((link: GraphEdgeDisplay) => {
    const style = EDGE_STYLES[link.edgeType as EdgeType];
    if (!style) return 'rgba(107,114,128,0.4)';

    // Convert hex color to rgba with the defined opacity
    const hex = style.color;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${style.opacity})`;
  }, []);

  const linkWidth = useCallback((link: GraphEdgeDisplay) => {
    const style = EDGE_STYLES[link.edgeType as EdgeType];
    return style ? Math.max(link.weight * 1.5, 0.5) : 0.5;
  }, []);

  const linkLineDash = useCallback((link: GraphEdgeDisplay) => {
    const style = EDGE_STYLES[link.edgeType as EdgeType];
    return style?.dashed ? [4, 2] : [];
  }, []);

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm">Loading knowledge graph...</span>
        </div>
      </div>
    );
  }

  if (graphData.nodes.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
        <span className="text-sm">
          No graph data yet. Start a debate to build the knowledge graph.
        </span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full w-full">
      <ForceGraph2D
        ref={graphRef}
        graphData={graphData}
        nodeId="id"
        nodeLabel="title"
        nodeVal="size"
        nodeCanvasObject={nodeCanvasObject}
        nodePointerAreaPaint={(node, color, ctx) => {
          const displayNode = node as GraphNodeDisplay & {
            x: number;
            y: number;
          };
          const radius = Math.sqrt(displayNode.size || 4) * 2;
          ctx.beginPath();
          ctx.arc(displayNode.x, displayNode.y, radius + 2, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
        }}
        linkSource="source"
        linkTarget="target"
        linkColor={linkColor as (link: object) => string}
        linkWidth={linkWidth as (link: object) => number}
        linkLineDash={linkLineDash as (link: object) => number[]}
        onNodeClick={handleNodeClick}
        backgroundColor="transparent"
        width={containerRef.current?.clientWidth || 800}
        height={containerRef.current?.clientHeight || 600}
        cooldownTicks={100}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
      />
    </div>
  );
}
