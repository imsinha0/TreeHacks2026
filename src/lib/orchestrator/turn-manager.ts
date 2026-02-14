import { SupabaseClient } from '@supabase/supabase-js';
import { Debate, DebateTurn, Citation } from '@/types/debate';
import { DebateAgent, AgentResponse } from '@/types/agent';
import { ResearchResults } from '@/lib/research/parallel-research';
import { DebaterAgent } from '../agents/debater';
import { FactCheckerAgent, FactCheckResult } from '../agents/fact-checker';
import { NODE_COLORS } from '@/types/graph';
import { generateId } from '@/lib/utils/id';

interface Document {
  id: string;
  title: string;
  summary: string;
  source_url: string;
}

export class TurnManager {
  constructor(private supabase: SupabaseClient) {}

  async processTurn(params: {
    debate: Debate;
    agent: DebateAgent;
    turnNumber: number;
    previousTurns: DebateTurn[];
    researchResults: ResearchResults;
    documents: Document[];
  }): Promise<{ turn: DebateTurn; factChecks: FactCheckResult[] }> {
    const { debate, agent, turnNumber, previousTurns, researchResults, documents } = params;

    // 1. Create a DebaterAgent instance and generate the argument
    const debaterAgent = new DebaterAgent(
      agent.role as 'pro' | 'con',
      process.env.ANTHROPIC_API_KEY!
    );

    const agentResponse = await debaterAgent.generateArgument({
      topic: debate.topic,
      debateType: debate.config.debateType,
      persona: agent.persona_description,
      previousTurns: previousTurns.map((t) => ({
        role: t.agent_id === agent.id ? agent.role : (agent.role === 'pro' ? 'con' : 'pro'),
        content: t.content,
      })),
      researchContext: researchResults.combinedContext,
      documents: documents.map((doc) => ({
        id: doc.id,
        title: doc.title,
        summary: doc.summary,
        source_url: doc.source_url,
      })),
    });

    // 2. Build citations from the agent's response
    const citations: Citation[] = [];
    const graphNodeIds: string[] = [];

    // 3. Create graph nodes for new claims/evidence from the agent's response
    for (const graphNode of agentResponse.graph_nodes) {
      const nodeId = generateId();
      const color = agent.role === 'pro' ? NODE_COLORS.pro : NODE_COLORS.con;

      const { error: nodeError } = await this.supabase.from('graph_nodes').insert({
        id: nodeId,
        debate_id: debate.id,
        node_type: graphNode.node_type,
        label: graphNode.label,
        title: graphNode.label,
        summary: graphNode.summary,
        color,
        size: graphNode.node_type === 'claim' ? 8.0 : 6.0,
        metadata: {
          agent_id: agent.id,
          agent_role: agent.role,
          turn_number: turnNumber,
          source_url: graphNode.source_url,
        },
      });

      if (nodeError) {
        console.error(`Failed to create graph node "${graphNode.label}":`, nodeError);
      } else {
        graphNodeIds.push(nodeId);
      }
    }

    // 4. Map agent citations to graph node references
    for (const agentCitation of agentResponse.citations) {
      // Try to find a matching graph node for this citation
      const matchingNodeId = await this.findOrCreateCitationNode(
        debate.id,
        agent.id,
        agentCitation,
        agent.role as 'pro' | 'con'
      );

      citations.push({
        node_id: matchingNodeId,
        label: agentCitation.label,
        source_url: agentCitation.source_url,
      });
    }

    // 5. Build research sources from the research results
    const researchSources = researchResults.sources.map((s) => ({
      url: s.url,
      title: s.title,
      snippet: s.snippet,
    }));

    // 6. Insert the turn into debate_turns table
    const turnId = generateId();
    const { data: turnData, error: turnError } = await this.supabase
      .from('debate_turns')
      .insert({
        id: turnId,
        debate_id: debate.id,
        agent_id: agent.id,
        turn_number: turnNumber,
        content: agentResponse.argument,
        research_sources: researchSources,
        citations,
      })
      .select()
      .single();

    if (turnError) {
      throw new Error(`Failed to insert debate turn: ${turnError.message}`);
    }

    const turn: DebateTurn = turnData as DebateTurn;

    // 7. Call highlight_cited_node() for each citation with a valid node_id
    await this.highlightCitedNodes(citations, agent);

    // 8. Concurrently run FactCheckerAgent on the claims
    const factChecks = await this.runFactChecks(
      debate,
      agent,
      turn,
      agentResponse,
      researchResults,
      graphNodeIds
    );

    return { turn, factChecks };
  }

  /**
   * Find an existing graph node for a citation, or create a new one if necessary.
   */
  private async findOrCreateCitationNode(
    debateId: string,
    agentId: string,
    citation: { document_id: string; label: string; source_url?: string },
    role: 'pro' | 'con'
  ): Promise<string> {
    // First, try to find a graph node linked to the cited document
    const { data: existingNode } = await this.supabase
      .from('graph_nodes')
      .select('id')
      .eq('debate_id', debateId)
      .eq('document_id', citation.document_id)
      .limit(1)
      .single();

    if (existingNode) {
      return existingNode.id;
    }

    // If no node found by document_id, try matching by label
    const { data: labelMatch } = await this.supabase
      .from('graph_nodes')
      .select('id')
      .eq('debate_id', debateId)
      .ilike('label', `%${citation.label}%`)
      .limit(1)
      .single();

    if (labelMatch) {
      return labelMatch.id;
    }

    // Create a new source node for this citation
    const nodeId = generateId();
    const color = role === 'pro' ? NODE_COLORS.pro : NODE_COLORS.con;

    await this.supabase.from('graph_nodes').insert({
      id: nodeId,
      debate_id: debateId,
      document_id: citation.document_id || null,
      node_type: 'source',
      label: citation.label,
      title: citation.label,
      summary: `Cited source: ${citation.source_url || citation.label}`,
      color,
      size: 5.0,
      metadata: {
        agent_id: agentId,
        source_url: citation.source_url,
      },
    });

    return nodeId;
  }

  /**
   * Highlight each cited node in the knowledge graph using the highlight_cited_node RPC.
   */
  private async highlightCitedNodes(
    citations: Citation[],
    agent: DebateAgent
  ): Promise<void> {
    const highlightColor = agent.role === 'pro' ? NODE_COLORS.pro : NODE_COLORS.con;

    const highlightPromises = citations.map(async (citation) => {
      if (!citation.node_id) return;

      const { error } = await this.supabase.rpc('highlight_cited_node', {
        p_node_id: citation.node_id,
        p_agent_id: agent.id,
        p_color: highlightColor,
      });

      if (error) {
        console.error(`Failed to highlight node ${citation.node_id}:`, error);
      }
    });

    await Promise.all(highlightPromises);
  }

  /**
   * Run fact-checking on the claims from the agent's response.
   * If lies are detected, inserts them into fact_checks and lie_alerts tables.
   */
  private async runFactChecks(
    debate: Debate,
    agent: DebateAgent,
    turn: DebateTurn,
    agentResponse: AgentResponse,
    researchResults: ResearchResults,
    graphNodeIds: string[]
  ): Promise<FactCheckResult[]> {
    if (agentResponse.claims.length === 0) {
      return [];
    }

    const factChecker = new FactCheckerAgent(process.env.ANTHROPIC_API_KEY!);

    const factCheckResults = await factChecker.checkClaims({
      topic: debate.topic,
      argument: agentResponse.argument,
      claims: agentResponse.claims,
      researchContext: researchResults.combinedContext,
    });

    // Insert fact check results and handle lie alerts
    for (let i = 0; i < factCheckResults.length; i++) {
      const fc = factCheckResults[i];

      // Try to associate the fact check with a graph node
      const graphNodeId = graphNodeIds[i] || null;

      const { data: factCheckRow, error: fcError } = await this.supabase
        .from('fact_checks')
        .insert({
          debate_id: debate.id,
          turn_id: turn.id,
          agent_id: agent.id,
          claim_text: fc.claim_text,
          verdict: fc.verdict,
          explanation: fc.explanation,
          sources: fc.sources,
          confidence: fc.confidence,
          is_lie: fc.is_lie,
          graph_node_id: graphNodeId,
        })
        .select()
        .single();

      if (fcError) {
        console.error(`Failed to insert fact check for claim "${fc.claim_text}":`, fcError);
        continue;
      }

      // If a lie is detected, create a lie alert
      if (fc.is_lie && factCheckRow) {
        const severity = fc.confidence >= 0.9 ? 'critical' : 'warning';

        const { error: alertError } = await this.supabase.from('lie_alerts').insert({
          debate_id: debate.id,
          fact_check_id: factCheckRow.id,
          agent_name: agent.name,
          claim_text: fc.claim_text,
          explanation: fc.explanation,
          severity,
        });

        if (alertError) {
          console.error(`Failed to insert lie alert for claim "${fc.claim_text}":`, alertError);
        }

        // Create a fact_checks edge in the graph if we have a graph node
        if (graphNodeId) {
          const fcNodeId = generateId();
          await this.supabase.from('graph_nodes').insert({
            id: fcNodeId,
            debate_id: debate.id,
            node_type: 'evidence',
            label: `Fact Check: ${fc.verdict}`,
            title: `Fact Check: ${fc.claim_text.slice(0, 50)}...`,
            summary: fc.explanation,
            color: NODE_COLORS.fact_check,
            size: 6.0,
            metadata: {
              verdict: fc.verdict,
              confidence: fc.confidence,
              is_lie: fc.is_lie,
            },
          });

          await this.supabase.from('graph_edges').insert({
            debate_id: debate.id,
            source_node_id: fcNodeId,
            target_node_id: graphNodeId,
            edge_type: 'fact_checks',
            label: `Verdict: ${fc.verdict}`,
            weight: fc.confidence,
          });
        }
      }
    }

    return factCheckResults;
  }
}
