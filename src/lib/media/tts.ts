import OpenAI from 'openai';

const TTS_MAX_CHARS = 4096;

export class TTSClient {
  private client: OpenAI;

  constructor(private apiKey: string) {
    this.client = new OpenAI({ apiKey: this.apiKey });
  }

  async synthesize(params: {
    text: string;
    voice: 'alloy' | 'echo' | 'nova' | 'shimmer';
  }): Promise<Buffer> {
    const chunks = this.splitText(params.text, TTS_MAX_CHARS);

    // Generate audio for all chunks in parallel
    const buffers = await Promise.all(
      chunks.map((chunk) => this.synthesizeChunk(chunk, params.voice))
    );

    // Concatenate all MP3 buffers
    return Buffer.concat(buffers);
  }

  private async synthesizeChunk(
    text: string,
    voice: 'alloy' | 'echo' | 'nova' | 'shimmer'
  ): Promise<Buffer> {
    try {
      const response = await this.client.audio.speech.create({
        model: 'tts-1',
        voice,
        input: text,
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

  /**
   * Split text into chunks under maxChars, breaking on sentence boundaries.
   */
  private splitText(text: string, maxChars: number): string[] {
    if (text.length <= maxChars) return [text];

    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      if (remaining.length <= maxChars) {
        chunks.push(remaining);
        break;
      }

      // Find the last sentence boundary within the limit
      const slice = remaining.slice(0, maxChars);
      let breakIndex = -1;

      // Try sentence-ending punctuation first
      for (const sep of ['. ', '! ', '? ', '.\n', '!\n', '?\n']) {
        const idx = slice.lastIndexOf(sep);
        if (idx > breakIndex) breakIndex = idx + sep.length;
      }

      // Fall back to newline or comma
      if (breakIndex <= 0) {
        const nlIdx = slice.lastIndexOf('\n');
        if (nlIdx > 0) breakIndex = nlIdx + 1;
      }
      if (breakIndex <= 0) {
        const commaIdx = slice.lastIndexOf(', ');
        if (commaIdx > 0) breakIndex = commaIdx + 2;
      }

      // Last resort: break at space
      if (breakIndex <= 0) {
        const spaceIdx = slice.lastIndexOf(' ');
        breakIndex = spaceIdx > 0 ? spaceIdx + 1 : maxChars;
      }

      chunks.push(remaining.slice(0, breakIndex).trimEnd());
      remaining = remaining.slice(breakIndex).trimStart();
    }

    return chunks;
  }
}
