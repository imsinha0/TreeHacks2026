'use client';

import { ReactNode, useState } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DebateLayoutProps {
  debatePanel: ReactNode;
  graphPanel: ReactNode;
}

export function DebateLayout({ debatePanel, graphPanel }: DebateLayoutProps) {
  const [graphCollapsed, setGraphCollapsed] = useState(false);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      <div className={`flex-1 overflow-hidden transition-all duration-300 ${graphCollapsed ? 'w-full' : 'w-1/2'}`}>
        {debatePanel}
      </div>
      <div className="relative flex items-start">
        <Button
          variant="ghost"
          size="icon"
          className="absolute -left-4 top-2 z-10 h-8 w-8 rounded-full border bg-background shadow-sm"
          onClick={() => setGraphCollapsed(!graphCollapsed)}
        >
          {graphCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>
      {!graphCollapsed && (
        <div className="w-1/2 border-l border-border overflow-hidden">
          {graphPanel}
        </div>
      )}
    </div>
  );
}
