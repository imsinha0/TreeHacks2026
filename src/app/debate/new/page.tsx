'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Swords,
  Gavel,
  ArrowLeft,
  Loader2,
  Mic,
  Search,
  Settings2,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DebateType } from '@/types/debate';

const VOICE_OPTIONS = [
  { value: 'alloy', label: 'Alloy' },
  { value: 'echo', label: 'Echo' },
  { value: 'nova', label: 'Nova' },
  { value: 'shimmer', label: 'Shimmer' },
] as const;

const DEBATE_TYPE_OPTIONS: { value: DebateType; label: string; description: string; icon: typeof Swords }[] = [
  {
    value: 'standard',
    label: 'Standard Debate',
    description: 'Two agents argue for and against a topic with research-backed arguments.',
    icon: Swords,
  },
  {
    value: 'court_simulation',
    label: 'Court Case Simulation',
    description: 'A simulated courtroom with prosecution, defense, and evidence presentation.',
    icon: Gavel,
  },
];

export default function NewDebatePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [debateType, setDebateType] = useState<DebateType>('standard');
  const [maxTurns, setMaxTurns] = useState(6);
  const [researchDepth, setResearchDepth] = useState<'quick' | 'standard' | 'deep'>('standard');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  // Agent config
  const [proName, setProName] = useState('Pro');
  const [proPersona, setProPersona] = useState('');
  const [proVoice, setProVoice] = useState('alloy');
  const [conName, setConName] = useState('Con');
  const [conPersona, setConPersona] = useState('');
  const [conVoice, setConVoice] = useState('echo');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!topic.trim()) {
      setError('Topic is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/debate/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          description: description.trim(),
          debateType,
          maxTurns,
          researchDepth,
          voiceEnabled,
          proAgent: {
            name: proName.trim() || 'Pro',
            persona: proPersona.trim(),
            voice: proVoice,
          },
          conAgent: {
            name: conName.trim() || 'Con',
            persona: conPersona.trim(),
            voice: conVoice,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create debate');
      }

      const data = await res.json();
      router.push(`/debate/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setIsSubmitting(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/')}
          className="mb-4 -ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Debates
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Create New Debate</h1>
        <p className="text-muted-foreground mt-1">
          Configure your AI debate and watch agents battle it out with research-backed arguments.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Topic & Description */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Swords className="h-5 w-5 text-primary" />
              Debate Topic
            </CardTitle>
            <CardDescription>
              What should the AI agents debate about?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="topic">Topic *</Label>
              <Input
                id="topic"
                placeholder="e.g., Should artificial intelligence be regulated by governments?"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                required
                className="text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Add additional context or specific angles you want the agents to explore..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Debate Type */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Settings2 className="h-5 w-5 text-primary" />
              Debate Format
            </CardTitle>
            <CardDescription>
              Choose the style of debate and configure settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Type Selector */}
            <div className="space-y-3">
              <Label>Debate Type</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {DEBATE_TYPE_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const isSelected = debateType === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setDebateType(option.value)}
                      className={`relative flex flex-col items-start gap-2 rounded-lg border-2 p-4 text-left transition-all hover:bg-accent/50 ${
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-border'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={`h-5 w-5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className="font-semibold">{option.label}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {option.description}
                      </p>
                      {isSelected && (
                        <div className="absolute right-3 top-3 h-2 w-2 rounded-full bg-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Settings Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxTurns">Max Turns</Label>
                <Input
                  id="maxTurns"
                  type="number"
                  min={2}
                  max={20}
                  value={maxTurns}
                  onChange={(e) => setMaxTurns(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">2 - 20 turns per side</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="researchDepth">Research Depth</Label>
                <Select value={researchDepth} onValueChange={(v) => setResearchDepth(v as 'quick' | 'standard' | 'deep')}>
                  <SelectTrigger id="researchDepth">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quick">
                      <div className="flex items-center gap-2">
                        <Search className="h-3 w-3" />
                        Quick
                      </div>
                    </SelectItem>
                    <SelectItem value="standard">
                      <div className="flex items-center gap-2">
                        <Search className="h-3 w-3" />
                        Standard
                      </div>
                    </SelectItem>
                    <SelectItem value="deep">
                      <div className="flex items-center gap-2">
                        <Search className="h-3 w-3" />
                        Deep
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">How thoroughly agents research</p>
              </div>

              <div className="space-y-4 pt-1">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={voiceEnabled}
                    onChange={(e) => setVoiceEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  <div className="flex items-center gap-1.5">
                    <Mic className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Voice Enabled</span>
                  </div>
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Agent Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Users className="h-5 w-5 text-primary" />
              Agent Configuration
            </CardTitle>
            <CardDescription>
              Customize each debating agent&apos;s identity, persona, and voice.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Pro Agent */}
              <div className="space-y-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-5">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-3 w-3 rounded-full bg-emerald-500" />
                  <h3 className="font-semibold text-emerald-600 dark:text-emerald-400">
                    Pro Agent
                  </h3>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="proName">Agent Name</Label>
                  <Input
                    id="proName"
                    placeholder="Pro"
                    value={proName}
                    onChange={(e) => setProName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="proPersona">Persona Description</Label>
                  <Textarea
                    id="proPersona"
                    placeholder="e.g., A passionate advocate with expertise in technology policy..."
                    value={proPersona}
                    onChange={(e) => setProPersona(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="proVoice">Voice</Label>
                  <Select value={proVoice} onValueChange={setProVoice}>
                    <SelectTrigger id="proVoice">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VOICE_OPTIONS.map((v) => (
                        <SelectItem key={v.value} value={v.value}>
                          {v.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Con Agent */}
              <div className="space-y-4 rounded-lg border border-rose-500/30 bg-rose-500/5 p-5">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-3 w-3 rounded-full bg-rose-500" />
                  <h3 className="font-semibold text-rose-600 dark:text-rose-400">
                    Con Agent
                  </h3>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="conName">Agent Name</Label>
                  <Input
                    id="conName"
                    placeholder="Con"
                    value={conName}
                    onChange={(e) => setConName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="conPersona">Persona Description</Label>
                  <Textarea
                    id="conPersona"
                    placeholder="e.g., A sharp critical thinker who emphasizes potential risks..."
                    value={conPersona}
                    onChange={(e) => setConPersona(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="conVoice">Voice</Label>
                  <Select value={conVoice} onValueChange={setConVoice}>
                    <SelectTrigger id="conVoice">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VOICE_OPTIONS.map((v) => (
                        <SelectItem key={v.value} value={v.value}>
                          {v.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error Message */}
        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pb-8">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/')}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" size="lg" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Debate...
              </>
            ) : (
              <>
                <Swords className="mr-2 h-4 w-4" />
                Create Debate
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
