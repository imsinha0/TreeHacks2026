'use client';

import Link from 'next/link';
import { Swords } from 'lucide-react';

export function Header() {
  return (
    <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center px-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <Swords className="h-6 w-6 text-primary" />
          <span>AI Debate Battleground</span>
        </Link>
        <nav className="ml-auto flex items-center gap-4">
          <Link
            href="/knowledge"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Knowledge Graph
          </Link>
          <Link
            href="/debate/new"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            New Debate
          </Link>
        </nav>
      </div>
    </header>
  );
}
