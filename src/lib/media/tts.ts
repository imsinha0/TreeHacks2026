import OpenAI from 'openai';

export class TTSClient {
  private client: OpenAI;

  constructor(private apiKey: string) {
    this.client = new OpenAI({ apiKey: this.apiKey });
  }

  async synthesize(params: {
    text: string;
    voice: 'alloy' | 'echo' | 'nova' | 'shimmer';
  }): Promise<Buffer> {
    try {
      const response = await this.client.audio.speech.create({
        model: 'tts-1',
        voice: params.voice,
        input: params.text,
        response_format: 'mp3',
      });

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      if (error instanceof OpenAI.APIError) {
        throw new Error(
          `OpenAI TTS API error (${error.status}): ${error.message}`
        );
      }
      throw new Error(
        `TTS synthesis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
