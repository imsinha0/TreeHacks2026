'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Swords, Clock, CheckCircle, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import { Debate } from '@/types/debate';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof Clock }> = {
  setup: { label: 'Setup', variant: 'outline', icon: Clock },
  researching: { label: 'Researching', variant: 'secondary', icon: Radio },
  live: { label: 'Live', variant: 'destructive', icon: Radio },
  voting: { label: 'Voting', variant: 'default', icon: Radio },
  summarizing: { label: 'Summarizing', variant: 'secondary', icon: Clock },
  completed: { label: 'Completed', variant: 'outline', icon: CheckCircle },
};

export default function HomePage() {
  const [debates, setDebates] = useState<Debate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDebates() {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('debates')
          .select('*')
          .order('created_at', { ascending: false });
        if (data) setDebates(data);
      } catch {
        // Supabase not configured yet
      } finally {
        setLoading(false);
      }
    }
    loadDebates();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Debate Battleground</h1>
          <p className="text-muted-foreground mt-1">
            Watch AI agents research, argue, and fact-check in real-time
          </p>
        </div>
        <Link href="/debate/new">
          <Button size="lg">
            <Plus className="mr-2 h-5 w-5" />
            New Debate
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-5 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-1/2 mt-2" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : debates.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Swords className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No debates yet</h2>
            <p className="text-muted-foreground mb-4">
              Create your first AI debate and watch agents battle it out
            </p>
            <Link href="/debate/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Debate
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {debates.map((debate) => {
            const status = statusConfig[debate.status] || statusConfig.setup;
            const StatusIcon = status.icon;
            return (
              <Link key={debate.id} href={`/debate/${debate.id}`}>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <Badge variant={status.variant}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {status.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(debate.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <CardTitle className="text-lg mt-2">{debate.topic}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {debate.description || 'No description'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      <span>{debate.config.maxTurns} turns</span>
                      <span>·</span>
                      <span>{debate.config.debateType === 'court_simulation' ? 'Court Case' : 'Standard'}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
