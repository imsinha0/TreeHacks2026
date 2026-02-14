import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from '@react-pdf/renderer';
import { createElement } from 'react';
import type { Debate, DebateSummary } from '@/types/debate';
import type { FactCheck } from '@/types/agent';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    fontFamily: 'Helvetica',
    color: '#1a1a1a',
  },
  title: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
    color: '#111827',
  },
  subtitle: {
    fontSize: 10,
    color: '#6b7280',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    marginTop: 20,
    marginBottom: 8,
    color: '#1f2937',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 4,
  },
  paragraph: {
    fontSize: 10,
    lineHeight: 1.6,
    color: '#374151',
    marginBottom: 8,
  },
  label: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#6b7280',
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  argumentCard: {
    marginBottom: 8,
    padding: 8,
    backgroundColor: '#f9fafb',
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  argumentRole: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#3b82f6',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  argumentText: {
    fontSize: 10,
    color: '#374151',
    lineHeight: 1.5,
  },
  argumentStrength: {
    fontSize: 9,
    color: '#6b7280',
    marginTop: 2,
  },
  claimCard: {
    marginBottom: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 4,
  },
  claimVerdict: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  claimText: {
    fontSize: 10,
    color: '#374151',
    marginBottom: 2,
  },
  claimExplanation: {
    fontSize: 9,
    color: '#6b7280',
    lineHeight: 1.4,
  },
  sourceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    padding: 6,
    backgroundColor: '#f9fafb',
    borderRadius: 4,
  },
  sourceTitle: {
    fontSize: 10,
    color: '#1f2937',
    maxWidth: '70%',
  },
  sourceScore: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },
  voteBar: {
    flexDirection: 'row',
    height: 20,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 4,
  },
  voteLabel: {
    fontSize: 10,
    color: '#374151',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    padding: 6,
    backgroundColor: '#f9fafb',
    borderRadius: 4,
  },
  statLabel: {
    fontSize: 10,
    color: '#6b7280',
  },
  statValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#1f2937',
  },
});

// ---------------------------------------------------------------------------
// Verdict color helpers
// ---------------------------------------------------------------------------

function verdictColor(verdict: string): string {
  switch (verdict) {
    case 'true':
    case 'mostly_true':
      return '#16a34a';
    case 'mixed':
      return '#ca8a04';
    case 'mostly_false':
    case 'false':
      return '#dc2626';
    default:
      return '#6b7280';
  }
}

function verdictLabel(verdict: string): string {
  switch (verdict) {
    case 'true':
      return 'TRUE';
    case 'mostly_true':
      return 'MOSTLY TRUE';
    case 'mixed':
      return 'MIXED';
    case 'mostly_false':
      return 'MOSTLY FALSE';
    case 'false':
      return 'FALSE';
    case 'unverifiable':
      return 'UNVERIFIABLE';
    default:
      return verdict.toUpperCase();
  }
}

// ---------------------------------------------------------------------------
// PDF Document definition (using createElement instead of JSX)
// ---------------------------------------------------------------------------

function DebatePDFDocument({
  debate,
  summary,
  factChecks,
}: {
  debate: Debate;
  summary: DebateSummary;
  factChecks: FactCheck[];
}) {
  const h = createElement;

  return h(
    Document,
    null,
    h(
      Page,
      { size: 'A4', style: styles.page },

      // Title
      h(Text, { style: styles.title }, debate.topic),
      h(
        Text,
        { style: styles.subtitle },
        `Debate Summary - ${new Date(debate.created_at).toLocaleDateString()}`
      ),

      // Overall Summary
      h(Text, { style: styles.sectionTitle }, 'Overall Summary'),
      h(Text, { style: styles.paragraph }, summary.overall_summary),

      // Winner Analysis
      h(Text, { style: styles.sectionTitle }, 'Winner Analysis'),
      h(Text, { style: styles.paragraph }, summary.winner_analysis),

      // Accuracy Scores
      h(Text, { style: styles.sectionTitle }, 'Accuracy Scores'),
      ...Object.entries(summary.accuracy_scores).map(([agent, score]) =>
        h(
          View,
          { key: agent, style: styles.statsRow },
          h(Text, { style: styles.statLabel }, agent),
          h(Text, { style: styles.statValue }, `${Math.round(score)}%`)
        )
      ),

      // Key Arguments
      h(Text, { style: styles.sectionTitle }, 'Key Arguments'),
      ...summary.key_arguments.map((arg, idx) =>
        h(
          View,
          {
            key: idx,
            style: {
              ...styles.argumentCard,
              borderLeftColor: arg.agent_role === 'pro' ? '#3b82f6' : '#ef4444',
            },
          },
          h(
            Text,
            {
              style: {
                ...styles.argumentRole,
                color: arg.agent_role === 'pro' ? '#3b82f6' : '#ef4444',
              },
            },
            arg.agent_role
          ),
          h(Text, { style: styles.argumentText }, arg.argument),
          h(
            Text,
            { style: styles.argumentStrength },
            `Strength: ${arg.strength}/10 | Supported by: ${arg.supported_by.join(', ') || 'N/A'}`
          )
        )
      )
    ),

    // Second page: fact checks, sources, votes
    h(
      Page,
      { size: 'A4', style: styles.page },

      // Fact Check Summary
      h(Text, { style: styles.sectionTitle }, 'Fact Check Summary'),
      h(
        View,
        { style: styles.statsRow },
        h(Text, { style: styles.statLabel }, 'Total Claims'),
        h(
          Text,
          { style: styles.statValue },
          String(summary.fact_check_summary.total_claims)
        )
      ),
      h(
        View,
        { style: styles.statsRow },
        h(Text, { style: styles.statLabel }, 'Verified True'),
        h(
          Text,
          { style: { ...styles.statValue, color: '#16a34a' } },
          String(summary.fact_check_summary.verified_true)
        )
      ),
      h(
        View,
        { style: styles.statsRow },
        h(Text, { style: styles.statLabel }, 'Verified False'),
        h(
          Text,
          { style: { ...styles.statValue, color: '#dc2626' } },
          String(summary.fact_check_summary.verified_false)
        )
      ),
      h(
        View,
        { style: styles.statsRow },
        h(Text, { style: styles.statLabel }, 'Mixed'),
        h(
          Text,
          { style: { ...styles.statValue, color: '#ca8a04' } },
          String(summary.fact_check_summary.mixed)
        )
      ),
      h(
        View,
        { style: styles.statsRow },
        h(Text, { style: styles.statLabel }, 'Unverifiable'),
        h(
          Text,
          { style: styles.statValue },
          String(summary.fact_check_summary.unverifiable)
        )
      ),

      // Individual Fact Checks
      h(Text, { style: styles.sectionTitle }, 'Detailed Fact Checks'),
      ...factChecks.map((fc) =>
        h(
          View,
          { key: fc.id, style: styles.claimCard },
          h(
            Text,
            {
              style: {
                ...styles.claimVerdict,
                color: verdictColor(fc.verdict),
              },
            },
            verdictLabel(fc.verdict)
          ),
          h(Text, { style: styles.claimText }, fc.claim_text),
          h(Text, { style: styles.claimExplanation }, fc.explanation)
        )
      ),

      // Sources
      h(Text, { style: styles.sectionTitle }, 'Sources Used'),
      ...summary.sources_used.map((source, idx) =>
        h(
          View,
          { key: idx, style: styles.sourceRow },
          h(Text, { style: styles.sourceTitle }, source.title || source.url),
          h(
            Text,
            {
              style: {
                ...styles.sourceScore,
                color:
                  source.reliability >= 0.8
                    ? '#16a34a'
                    : source.reliability >= 0.6
                    ? '#ca8a04'
                    : '#dc2626',
              },
            },
            `${Math.round(source.reliability * 100)}%`
          )
        )
      ),

      // Vote Results
      ...(summary.vote_results
        ? [
            h(Text, { key: 'vote-title', style: styles.sectionTitle }, 'Vote Results'),
            h(
              View,
              { key: 'vote-bar', style: styles.voteBar },
              h(View, {
                style: {
                  width: `${summary.vote_results.pro_percentage}%`,
                  backgroundColor: '#3b82f6',
                },
              }),
              h(View, {
                style: {
                  width: `${summary.vote_results.con_percentage}%`,
                  backgroundColor: '#ef4444',
                },
              })
            ),
            h(
              Text,
              { key: 'vote-label', style: styles.voteLabel },
              `PRO: ${summary.vote_results.pro_count} votes (${Math.round(summary.vote_results.pro_percentage)}%) | CON: ${summary.vote_results.con_count} votes (${Math.round(summary.vote_results.con_percentage)}%) | Total: ${summary.vote_results.total}`
            ),
          ]
        : [])
    )
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function generateDebatePDF(params: {
  debate: Debate;
  summary: DebateSummary;
  factChecks: FactCheck[];
}): Promise<Blob> {
  const doc = DebatePDFDocument({
    debate: params.debate,
    summary: params.summary,
    factChecks: params.factChecks,
  });

  const blob = await pdf(doc).toBlob();
  return blob;
}
