import type { Debate, DebateSummary } from '@/types/debate';
import type { FactCheck } from '@/types/agent';

// ---------------------------------------------------------------------------
// Verdict helpers
// ---------------------------------------------------------------------------

function verdictEmoji(verdict: string): string {
  switch (verdict) {
    case 'true':
      return '[TRUE]';
    case 'mostly_true':
      return '[MOSTLY TRUE]';
    case 'mixed':
      return '[MIXED]';
    case 'mostly_false':
      return '[MOSTLY FALSE]';
    case 'false':
      return '[FALSE]';
    case 'unverifiable':
      return '[UNVERIFIABLE]';
    default:
      return `[${verdict.toUpperCase()}]`;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function generateDebateMarkdown(params: {
  debate: Debate;
  summary: DebateSummary;
  factChecks: FactCheck[];
}): string {
  const { debate, summary, factChecks } = params;
  const lines: string[] = [];

  // Title
  lines.push(`# ${debate.topic}`);
  lines.push('');
  lines.push(
    `*Debate Summary - ${new Date(debate.created_at).toLocaleDateString()}*`
  );
  lines.push('');
  if (debate.description) {
    lines.push(`> ${debate.description}`);
    lines.push('');
  }

  // Overall Summary
  lines.push('---');
  lines.push('');
  lines.push('## Overall Summary');
  lines.push('');
  lines.push(summary.overall_summary);
  lines.push('');

  // Winner Analysis
  lines.push('## Winner Analysis');
  lines.push('');
  lines.push(summary.winner_analysis);
  lines.push('');

  // Recommendations
  if (summary.recommendations) {
    lines.push('### Recommendations');
    lines.push('');
    lines.push(summary.recommendations);
    lines.push('');
  }

  // Accuracy Scores
  lines.push('## Accuracy Scores');
  lines.push('');
  lines.push('| Agent | Accuracy |');
  lines.push('|-------|----------|');
  for (const [agent, score] of Object.entries(summary.accuracy_scores)) {
    lines.push(`| ${agent} | ${Math.round(score)}% |`);
  }
  lines.push('');

  // Key Arguments
  lines.push('## Key Arguments');
  lines.push('');
  for (const arg of summary.key_arguments) {
    const roleTag = arg.agent_role.toUpperCase();
    lines.push(`### ${roleTag}`);
    lines.push('');
    lines.push(`- **Argument:** ${arg.argument}`);
    lines.push(`- **Strength:** ${arg.strength}/10`);
    if (arg.supported_by.length > 0) {
      lines.push(`- **Supported by:** ${arg.supported_by.join(', ')}`);
    }
    lines.push('');
  }

  // Fact Check Summary
  lines.push('## Fact Check Summary');
  lines.push('');
  lines.push(`- **Total Claims:** ${summary.fact_check_summary.total_claims}`);
  lines.push(
    `- **Verified True:** ${summary.fact_check_summary.verified_true}`
  );
  lines.push(
    `- **Verified False:** ${summary.fact_check_summary.verified_false}`
  );
  lines.push(`- **Mixed:** ${summary.fact_check_summary.mixed}`);
  lines.push(
    `- **Unverifiable:** ${summary.fact_check_summary.unverifiable}`
  );
  lines.push('');

  // Detailed Fact Checks
  if (factChecks.length > 0) {
    lines.push('## Detailed Fact Checks');
    lines.push('');

    for (const fc of factChecks) {
      lines.push(
        `### ${verdictEmoji(fc.verdict)} ${fc.claim_text}`
      );
      lines.push('');
      lines.push(`**Confidence:** ${Math.round(fc.confidence * 100)}%`);
      if (fc.is_lie) {
        lines.push('**Warning: Lie detected**');
      }
      lines.push('');
      lines.push(fc.explanation);
      lines.push('');
      if (fc.sources && fc.sources.length > 0) {
        lines.push('**Sources:**');
        for (const source of fc.sources) {
          lines.push(`- [${source.title || source.url}](${source.url})`);
        }
        lines.push('');
      }
    }
  }

  // Sources Used
  lines.push('## Sources Used');
  lines.push('');
  if (summary.sources_used.length > 0) {
    lines.push('| Source | Reliability | Cited By |');
    lines.push('|--------|------------|----------|');
    for (const source of summary.sources_used) {
      const title = source.title || source.url;
      const reliability = `${Math.round(source.reliability * 100)}%`;
      const citedBy = source.cited_by.join(', ') || 'N/A';
      lines.push(
        `| [${title}](${source.url}) | ${reliability} | ${citedBy} |`
      );
    }
    lines.push('');
  } else {
    lines.push('No sources recorded.');
    lines.push('');
  }

  // Vote Results
  if (summary.vote_results) {
    const vr = summary.vote_results;
    lines.push('## Vote Results');
    lines.push('');
    lines.push(`- **PRO:** ${vr.pro_count} votes (${Math.round(vr.pro_percentage)}%)`);
    lines.push(`- **CON:** ${vr.con_count} votes (${Math.round(vr.con_percentage)}%)`);
    lines.push(`- **Total Votes:** ${vr.total}`);
    lines.push('');
  }

  // Footer
  lines.push('---');
  lines.push('');
  lines.push('*Generated by AI Debate Platform*');
  lines.push('');

  return lines.join('\n');
}
