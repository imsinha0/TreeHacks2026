import { createServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { generateEmbedding } from '@/lib/utils/embeddings';

/**
 * Demo data for abortion debate topic
 * This can be used to quickly populate the knowledge graph with sample documents
 */
const DEMO_DOCUMENTS = [
  {
    title: 'Roe v. Wade: Landmark Supreme Court Decision',
    snippet: 'The 1973 Supreme Court decision that established a woman\'s constitutional right to abortion. The ruling recognized privacy rights under the Due Process Clause of the 14th Amendment.',
    source_url: 'https://example.com/roe-v-wade',
  },
  {
    title: 'Dobbs v. Jackson Women\'s Health Organization',
    snippet: 'The 2022 Supreme Court decision that overturned Roe v. Wade, returning abortion regulation to individual states. This marked a significant shift in abortion law in the United States.',
    source_url: 'https://example.com/dobbs-v-jackson',
  },
  {
    title: 'Medical Safety of Abortion Procedures',
    snippet: 'Abortion is one of the safest medical procedures when performed by trained professionals. The risk of complications is extremely low, with mortality rates lower than childbirth.',
    source_url: 'https://example.com/abortion-safety',
  },
  {
    title: 'Fetal Development and Viability',
    snippet: 'Fetal viability typically occurs around 24 weeks of pregnancy. Before this point, a fetus cannot survive outside the womb without extraordinary medical intervention.',
    source_url: 'https://example.com/fetal-viability',
  },
  {
    title: 'Religious Perspectives on Abortion',
    snippet: 'Different religious traditions hold varying views on abortion. Some emphasize the sanctity of life from conception, while others consider factors like maternal health and circumstances.',
    source_url: 'https://example.com/religious-views',
  },
  {
    title: 'Economic Impact of Abortion Access',
    snippet: 'Studies show that access to abortion services correlates with improved economic outcomes for women, including higher educational attainment and workforce participation.',
    source_url: 'https://example.com/economic-impact',
  },
  {
    title: 'State Abortion Restrictions After Dobbs',
    snippet: 'Following the Dobbs decision, many states implemented strict abortion bans, while others strengthened protections. This created a patchwork of laws across the country.',
    source_url: 'https://example.com/state-restrictions',
  },
  {
    title: 'International Abortion Laws Comparison',
    snippet: 'Abortion laws vary widely internationally. Some countries have liberal access, while others have strict restrictions. The United States now has more restrictive laws than many developed nations.',
    source_url: 'https://example.com/international-laws',
  },
];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { openaiApiKey } = body;

    if (!openaiApiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key required' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // First, insert documents into documents table
    console.log('Inserting demo documents...');
    const docRows = DEMO_DOCUMENTS.map((doc) => ({
      debate_id: null, // Demo data, not tied to a specific debate
      title: doc.title,
      summary: doc.snippet,
      content: doc.snippet,
      source_url: doc.source_url,
      source_type: 'web' as const,
    }));

    const { data: insertedDocs, error: docInsertError } = await supabase
      .from('documents')
      .insert(docRows)
      .select('id');

    if (docInsertError || !insertedDocs || insertedDocs.length === 0) {
      return NextResponse.json(
        { error: 'Failed to insert documents', details: docInsertError?.message },
        { status: 500 }
      );
    }

    console.log(`Inserted ${insertedDocs.length} documents, generating embeddings...`);

    // Generate embeddings for each document
    const embeddingRows = [];

    for (let i = 0; i < DEMO_DOCUMENTS.length; i++) {
      try {
        const doc = DEMO_DOCUMENTS[i];
        const docId = insertedDocs[i]?.id;
        
        if (!docId) {
          console.warn(`No document ID for "${doc.title}"`);
          continue;
        }

        const textToEmbed = `${doc.title}. ${doc.snippet}`;
        const embedding = await generateEmbedding(textToEmbed, openaiApiKey);

        embeddingRows.push({
          id: docId, // Use the document ID from documents table
          embedding,
        });

        // Small delay to respect rate limits
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (err) {
        console.error(`Failed to generate embedding for "${DEMO_DOCUMENTS[i].title}":`, err);
      }
    }

    if (embeddingRows.length === 0) {
      return NextResponse.json(
        { error: 'Failed to generate any embeddings' },
        { status: 500 }
      );
    }

    // Insert into document_embeddings table (only id + embedding)
    const { error: insertError } = await supabase
      .from('document_embeddings')
      .insert(embeddingRows);

    if (insertError) {
      console.error('Failed to insert demo embeddings:', insertError);
      return NextResponse.json(
        { error: 'Failed to insert embeddings', details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      count: embeddingRows.length,
      message: `Successfully inserted ${embeddingRows.length} demo document embeddings`,
    });
  } catch (error) {
    console.error('Error in demo data API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

