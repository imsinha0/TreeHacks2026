import { NextResponse } from 'next/server';
import { HeyGenClient } from '@/lib/media/heygen';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'Missing required field: action' },
        { status: 400 }
      );
    }

    const apiKey = process.env.HEYGEN_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'HeyGen API key not configured' },
        { status: 500 }
      );
    }

    const heygenClient = new HeyGenClient(apiKey);

    switch (action) {
      case 'create': {
        const { avatar_id } = body;
        if (!avatar_id) {
          return NextResponse.json(
            { error: 'Missing required field: avatar_id' },
            { status: 400 }
          );
        }

        const session = await heygenClient.createSession(avatar_id);
        return NextResponse.json({
          session_id: session.sessionId,
          sdp_offer: session.sdpOffer,
          ice_servers: session.iceServers,
        });
      }

      case 'send_audio': {
        const { session_id, audio_data } = body;
        if (!session_id || !audio_data) {
          return NextResponse.json(
            { error: 'Missing required fields: session_id, audio_data' },
            { status: 400 }
          );
        }

        // audio_data is expected as a base64-encoded string
        const audioBuffer = Buffer.from(audio_data, 'base64');
        await heygenClient.sendAudio(session_id, audioBuffer);
        return NextResponse.json({ success: true });
      }

      case 'close': {
        const { session_id } = body;
        if (!session_id) {
          return NextResponse.json(
            { error: 'Missing required field: session_id' },
            { status: 400 }
          );
        }

        await heygenClient.closeSession(session_id);
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Valid actions: create, send_audio, close` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in avatar endpoint:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
