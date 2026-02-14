'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { User, Info } from 'lucide-react';
import type { DebateAgent } from '@/types/agent';

interface AgentPanelProps {
  agent: DebateAgent;
  isSpeaking: boolean;
  currentTurnContent?: string;
}

export default function AgentPanel({
  agent,
  isSpeaking,
  currentTurnContent,
}: AgentPanelProps) {
  const isPro = agent.role === 'pro';
  const roleBadgeClasses = isPro
    ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    : 'bg-red-500/20 text-red-400 border-red-500/30';
  const avatarRingClasses = isPro
    ? 'ring-blue-500/50'
    : 'ring-red-500/50';
  const speakingGlowClasses = isPro
    ? 'shadow-blue-500/30'
    : 'shadow-red-500/30';

  return (
    <Card
      className={`relative overflow-hidden transition-shadow duration-300 ${
        isSpeaking ? `shadow-lg ${speakingGlowClasses}` : ''
      }`}
    >
      <CardContent className="flex items-center gap-3 p-3">
        {/* Avatar placeholder */}
        <div className="relative shrink-0">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-full bg-muted ring-2 ${avatarRingClasses}`}
          >
            {/* Will be replaced with HeyGen avatar later */}
            <User className="h-6 w-6 text-muted-foreground" />
          </div>

          {/* Speaking indicator - pulsing dot */}
          {isSpeaking && (
            <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5">
              <span
                className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                  isPro ? 'bg-blue-400' : 'bg-red-400'
                }`}
              />
              <span
                className={`relative inline-flex h-3.5 w-3.5 rounded-full ${
                  isPro ? 'bg-blue-500' : 'bg-red-500'
                }`}
              />
            </span>
          )}
        </div>

        {/* Agent info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold truncate">{agent.name}</span>
            <Badge variant="outline" className={`text-[10px] shrink-0 ${roleBadgeClasses}`}>
              {agent.role.toUpperCase()}
            </Badge>

            {/* Persona description tooltip */}
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[250px] text-xs">
                  <p>{agent.persona_description}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Current speaking preview */}
          {isSpeaking && currentTurnContent && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-1 animate-pulse">
              {currentTurnContent}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
