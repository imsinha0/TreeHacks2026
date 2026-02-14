import { SupabaseClient } from '@supabase/supabase-js';
import type { GraphNode } from '@/types/graph';
import { GraphManager } from './graph-manager';

/**
 * Color mapping for document source types.
 */
const SOURCE_TYPE_COLORS: Record<string, string> = {
  perplexity: '#8B5CF6',
  web: '#3B82F6',
  pdf: '#EF4444',
  upload: '#F97316',
  manual: '#22C55E',
  academic: '#FBBF24',
  news: '#06B6D4',
};

const DEFAULT_COLOR = '#6B7280';

/**
 * Build knowledge graph nodes from a set of documents.
 * Creates one graph node per document with colors assigned based on source_type.
 */
export async function buildGraphFromDocuments(
  supabase: SupabaseClient,
  debateId: string,
  documents: Array<{
    id: string;
    title: string;
    summary: string;
    source_url?: string;
    source_type: string;
  }>
): Promise<GraphNode[]> {
  const manager = new GraphManager(supabase);
  const createdNodes: GraphNode[] = [];

  for (const doc of documents) {
    const color = SOURCE_TYPE_COLORS[doc.source_type] ?? DEFAULT_COLOR;

    try {
      const node = await manager.createNode({
        debateId,
        documentId: doc.id,
        nodeType: 'document',
        label: doc.title.length > 40 ? doc.title.slice(0, 37) + '...' : doc.title,
        title: doc.title,
        summary: doc.summary,
        metadata: {
          source_type: doc.source_type,
          source_url: doc.source_url ?? null,
        },
        color,
        size: 5,
      });

      createdNodes.push(node);
    } catch (error) {
      console.error(`Failed to create graph node for document ${doc.id}:`, error);
    }
  }

  return createdNodes;
}
