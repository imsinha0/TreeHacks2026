'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useDebateRealtime } from '@/hooks/useDebateRealtime';
import { useLieAlerts } from '@/hooks/useLieAlerts';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { DebateLayout } from '@/components/layout/DebateLayout';
import AgentPanel from '@/components/debate/AgentPanel';
import DebateTurnCard from '@/components/debate/DebateTurnCard';
import LieAlertPopup from '@/components/debate/LieAlertPopup';
import VotingPanel from '@/components/debate/VotingPanel';
import KnowledgeGraph2D from '@/components/graph/KnowledgeGraph2D';
import GraphControls from '@/components/graph/GraphControls';
import GraphLegend from '@/components/graph/GraphLegend';
import NodeDetailPanel from '@/components/graph/NodeDetailPanel';
import GraphHighlighter from '@/components/graph/GraphHighlighter';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, Radio } from 'lucide-react';
import type { DebateAgent } from '@/types/agent';

interface DebateTheaterProps {
  debateId: string;
}

export default function DebateTheater({ debateId }: DebateTheaterProps) {
  // Core hooks
  const { debate, turns, agents, loading, error } = useDebateRealtime(debateId);
  const { activeAlert, dismissAlert } = useLieAlerts(debateId);
  const { enqueue } = useAudioPlayer();

  // Graph state management
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [similarityThreshold, setSimilarityThreshold] = useState(0.75);
  const [nodeTypeFilter, setNodeTypeFilter] = useState<string[]>([
    'document',
    'claim',
    'entity',
    'concept',
    'evidence',
    'source',
  ]);
  const [searchQuery, setSearchQuery] = useState('');

  // Highlighted node (from citation click or graph highlighter)
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up highlight timer on unmount
  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
    };
  }, []);

  // Resolve agents by role
  const proAgent = useMemo(
    () => agents.find((a) => a.role === 'pro') ?? null,
    [agents]
  );
  const conAgent = useMemo(
    () => agents.find((a) => a.role === 'con') ?? null,
    [agents]
  );

  // Determine which agent is currently speaking (last turn's agent)
  const lastTurn = turns.length > 0 ? turns[turns.length - 1] : null;
  const speakingAgentId =
    debate?.status === 'live' && lastTurn ? lastTurn.agent_id : null;

  // Audio: enqueue new turn audio when it arrives
  const lastEnqueuedTurnRef = useRef<string | null>(null);
  useEffect(() => {
    if (!lastTurn || !lastTurn.audio_url) return;
    if (lastEnqueuedTurnRef.current === lastTurn.id) return;
    lastEnqueuedTurnRef.current = lastTurn.id;
    enqueue(lastTurn.audio_url);
  }, [lastTurn, enqueue]);

  // Build a map from agent_id to agent for quick lookups
  const agentMap = useMemo(() => {
    const map = new Map<string, DebateAgent>();
    agents.forEach((a) => map.set(a.id, a));
    return map;
  }, [agents]);

  // Citation click handler - highlights corresponding graph node
  const handleCitationClick = useCallback((nodeId: string) => {
    setHighlightedNodeId(nodeId);
    setSelectedNodeId(nodeId);

    // Clear highlight after 5 seconds
    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
    }
    highlightTimerRef.current = setTimeout(() => {
      setHighlightedNodeId(null);
      highlightTimerRef.current = null;
    }, 5000);
  }, []);

  // Graph node click handler
  const handleGraphNodeClick = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
  }, []);

  // Graph highlighter callbacks
  const handleGraphHighlight = useCallback((nodeId: string) => {
    setHighlightedNodeId(nodeId);
  }, []);

  const handleGraphClearHighlight = useCallback(() => {
    setHighlightedNodeId(null);
  }, []);

  // Dismiss alert handler
  const handleDismissAlert = useCallback(() => {
    if (activeAlert) {
      dismissAlert(activeAlert.id);
    }
  }, [activeAlert, dismissAlert]);

  // Status indicator
  const statusConfig: Record<string, { label: string; color: string }> = {
    setup: { label: 'Setting up', color: 'bg-gray-500' },
    researching: { label: 'Researching', color: 'bg-yellow-500' },
    live: { label: 'Live', color: 'bg-green-500' },
    voting: { label: 'Voting', color: 'bg-purple-500' },
    summarizing: { label: 'Summarizing', color: 'bg-blue-500' },
    completed: { label: 'Completed', color: 'bg-gray-500' },
  };

  const currentStatus = debate?.status
    ? statusConfig[debate.status] || { label: debate.status, color: 'bg-gray-500' }
    : null;

  // Loading state
  if (loading) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Loading debate...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  // --- Debate Panel (left) ---
  const debatePanel = (
    <div className="flex h-full flex-col">
      {/* Agent panels at top */}
      <div className="flex gap-3 p-4 pb-2 shrink-0">
        {proAgent && (
          <div className="flex-1">
            <AgentPanel
              agent={proAgent}
              isSpeaking={speakingAgentId === proAgent.id}
              currentTurnContent={
                speakingAgentId === proAgent.id && lastTurn
                  ? lastTurn.content.slice(0, 80) + '...'
                  : undefined
              }
            />
          </div>
        )}
        {conAgent && (
          <div className="flex-1">
            <AgentPanel
              agent={conAgent}
              isSpeaking={speakingAgentId === conAgent.id}
              currentTurnContent={
                speakingAgentId === conAgent.id && lastTurn
                  ? lastTurn.content.slice(0, 80) + '...'
                  : undefined
              }
            />
          </div>
        )}
      </div>

      {/* Status indicator */}
      {currentStatus && (
        <div className="flex items-center gap-2 px-4 py-1.5 shrink-0">
          <span className={`h-2 w-2 rounded-full ${currentStatus.color} ${
            debate?.status === 'live' ? 'animate-pulse' : ''
          }`} />
          <span className="text-xs text-muted-foreground font-medium">
            {currentStatus.label}
          </span>
          {debate?.status === 'live' && (
            <Badge variant="outline" className="text-[10px] gap-1 text-green-400 border-green-500/30">
              <Radio className="h-2.5 w-2.5" />
              LIVE
            </Badge>
          )}
          {debate?.topic && (
            <span className="text-xs text-muted-foreground truncate ml-auto">
              {debate.topic}
            </span>
          )}
        </div>
      )}

      {/* Scrollable turn transcript */}
      <ScrollArea className="flex-1 px-4 pb-4">
        <div className="space-y-3 pt-2">
          {turns.map((turn) => {
            const agent = agentMap.get(turn.agent_id);
            return (
              <DebateTurnCard
                key={turn.id}
                turn={turn}
                agentName={agent?.name ?? 'Unknown Agent'}
                agentRole={(agent?.role as 'pro' | 'con') ?? 'pro'}
                onCitationClick={handleCitationClick}
              />
            );
          })}

          {turns.length === 0 && debate?.status !== 'completed' && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <p className="text-sm">
                {debate?.status === 'researching'
                  ? 'Agents are researching the topic...'
                  : debate?.status === 'setup'
                  ? 'Setting up the debate...'
                  : 'Waiting for the debate to start...'}
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );

  // --- Graph Panel (right) ---
  const graphPanel = (
    <div className="relative flex h-full flex-col">
      {/* Graph controls at top */}
      <div className="shrink-0 p-3 pb-0 space-y-2">
        <GraphControls
          similarityThreshold={similarityThreshold}
          onThresholdChange={setSimilarityThreshold}
          nodeTypeFilter={nodeTypeFilter}
          onFilterChange={setNodeTypeFilter}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
        <GraphLegend />
      </div>

      {/* Main graph area */}
      <div className="flex-1 relative">
        <KnowledgeGraph2D
          debateId={debateId}
          onNodeClick={handleGraphNodeClick}
          highlightedNodeId={highlightedNodeId}
        />

        {/* Node detail panel (overlay) */}
        <NodeDetailPanel
          nodeId={selectedNodeId}
          debateId={debateId}
          onClose={() => setSelectedNodeId(null)}
        />
      </div>

      {/* Graph highlighter (renders nothing, just subscribes to realtime) */}
      <GraphHighlighter
        debateId={debateId}
        onHighlight={handleGraphHighlight}
        onClearHighlight={handleGraphClearHighlight}
      />
    </div>
  );

  return (
    <>
      <DebateLayout debatePanel={debatePanel} graphPanel={graphPanel} />

      {/* Lie alert overlay */}
      <LieAlertPopup alert={activeAlert} onDismiss={handleDismissAlert} />

      {/* Voting panel overlay when debate status is 'voting' */}
      {debate?.status === 'voting' && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <VotingPanel debateId={debateId} debateTopic={debate.topic} />
        </div>
      )}
    </>
  );
}
