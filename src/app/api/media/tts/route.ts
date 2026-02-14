import { NextResponse } from 'next/server';
import { TTSClient } from '@/lib/media/tts';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text, voice, debate_id, turn_id } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: text' },
        { status: 400 }
      );
    }

    const validVoices = ['alloy', 'echo', 'nova', 'shimmer'] as const;
    const selectedVoice = validVoices.includes(voice) ? voice : 'alloy';

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const ttsClient = new TTSClient(apiKey);
    const audioBuffer = await ttsClient.synthesize({
      text,
      voice: selectedVoice,
    });

    // If debate_id and turn_id are provided, upload to Supabase Storage
    if (debate_id && turn_id) {
      const supabase = createServerClient();
      const filePath = `${debate_id}/${turn_id}.mp3`;

      const { error: uploadError } = await supabase.storage
        .from('debate-audio')
        .upload(filePath, audioBuffer, {
          contentType: 'audio/mpeg',
          upsert: true,
        });

      if (uploadError) {
        console.error('Failed to upload audio to Supabase:', uploadError);
        return NextResponse.json(
          { error: 'Failed to upload audio to storage' },
          { status: 500 }
        );
      }

      const { data: publicUrlData } = supabase.storage
        .from('debate-audio')
        .getPublicUrl(filePath);

      return NextResponse.json({ audio_url: publicUrlData.publicUrl });
    }

    // Fallback: return audio as a blob response
    return new Response(new Uint8Array(audioBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error in TTS endpoint:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
