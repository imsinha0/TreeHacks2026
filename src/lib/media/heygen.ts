const HEYGEN_API_BASE = 'https://api.heygen.com/v1';

export interface HeyGenSession {
  sessionId: string;
  sdpOffer?: string;
  iceServers?: Array<{ urls: string; username?: string; credential?: string }>;
}

export class HeyGenClient {
  constructor(private apiKey: string) {}

  async createSession(avatarId: string): Promise<HeyGenSession> {
    try {
      const response = await fetch(`${HEYGEN_API_BASE}/streaming.new`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify({
          avatar_id: avatarId,
          quality: 'medium',
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Unable to read error body');
        throw new Error(
          `HeyGen streaming.new failed with status ${response.status}: ${errorBody}`
        );
      }

      const data = await response.json();

      return {
        sessionId: data.data?.session_id ?? data.session_id,
        sdpOffer: data.data?.sdp_offer ?? data.sdp_offer,
        iceServers: data.data?.ice_servers ?? data.ice_servers ?? [],
      };
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('HeyGen streaming.new failed')) {
        throw error;
      }
      throw new Error(
        `Failed to create HeyGen session: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async sendAudio(sessionId: string, audioBuffer: Buffer): Promise<void> {
    try {
      const base64Audio = audioBuffer.toString('base64');

      const response = await fetch(`${HEYGEN_API_BASE}/streaming.task`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify({
          session_id: sessionId,
          task_type: 'audio',
          task_input: {
            audio: base64Audio,
          },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Unable to read error body');
        throw new Error(
          `HeyGen streaming.task failed with status ${response.status}: ${errorBody}`
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('HeyGen streaming.task failed')) {
        throw error;
      }
      throw new Error(
        `Failed to send audio to HeyGen session ${sessionId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async closeSession(sessionId: string): Promise<void> {
    try {
      const response = await fetch(`${HEYGEN_API_BASE}/streaming.stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify({
          session_id: sessionId,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Unable to read error body');
        throw new Error(
          `HeyGen streaming.stop failed with status ${response.status}: ${errorBody}`
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('HeyGen streaming.stop failed')) {
        throw error;
      }
      throw new Error(
        `Failed to close HeyGen session ${sessionId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
