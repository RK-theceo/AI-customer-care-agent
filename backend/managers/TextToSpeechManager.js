const axios = require('axios');

/**
 * TextToSpeechManager
 * 
 * Converts text responses to natural-sounding speech
 * Handles:
 * - Audio synthesis
 * - Streaming audio
 * - Voice selection
 * - Prosody and emotion
 */
class TextToSpeechManager {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.voiceId = process.env.ELEVENLABS_VOICE_ID || 'Rachel';
    this.apiKey = process.env.ELEVENLABS_API_KEY;
    this.baseUrl = 'https://api.elevenlabs.io/v1';
    this.wsConnections = [];
  }

  /**
   * Convert text to audio
   * Returns audio stream/buffer
   */
  async synthesizeText(text, options = {}) {
    const {
      voiceId = this.voiceId,
      stability = 0.5,
      similarityBoost = 0.75,
    } = options;

    try {
      const response = await axios.post(
        `${this.baseUrl}/text-to-speech/${voiceId}`,
        {
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability,
            similarity_boost: similarityBoost,
          },
        },
        {
          headers: {
            'xi-api-key': this.apiKey,
            'Content-Type': 'application/json',
          },
          responseType: 'arraybuffer',
        }
      );

      return {
        audio: response.data,
        format: 'mp3',
        duration: this._estimateDuration(text),
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error(`[${this.sessionId}] TTS error:`, error.message);
      return this._getFallbackAudio(text);
    }
  }

  /**
   * Stream audio to client via WebSocket
   */
  streamAudioToClient(ws, audioBuffer) {
    if (!ws || ws.readyState !== 1) {
      console.error(`[${this.sessionId}] Invalid WebSocket connection`);
      return;
    }

    try {
      // Send audio in chunks (more responsive)
      const chunkSize = 4096;
      for (let i = 0; i < audioBuffer.length; i += chunkSize) {
        const chunk = audioBuffer.slice(i, i + chunkSize);
        ws.send(
          JSON.stringify({
            type: 'audio',
            data: chunk.toString('base64'),
            isFinal: i + chunkSize >= audioBuffer.length,
          })
        );
      }
    } catch (error) {
      console.error(`[${this.sessionId}] Error streaming audio:`, error);
    }
  }

  /**
   * Estimate speech duration from text
   * Average 150 words per minute = 2.5 words per second
   */
  _estimateDuration(text) {
    const wordCount = text.split(' ').length;
    const estimatedSeconds = (wordCount / 2.5) * 1000; // Convert to ms
    return Math.max(estimatedSeconds, 500); // Minimum 500ms
  }

  /**
   * Get fallback audio (pre-recorded messages)
   */
  async _getFallbackAudio(text) {
    return {
      audio: Buffer.from([]),
      format: 'mp3',
      duration: 2000,
      isFallback: true,
    };
  }

  /**
   * Add WebSocket connection for streaming
   */
  registerConnection(ws) {
    this.wsConnections.push(ws);
  }

  /**
   * Remove WebSocket connection
   */
  unregisterConnection(ws) {
    this.wsConnections = this.wsConnections.filter((c) => c !== ws);
  }

  /**
   * Broadcast audio to all connected clients
   */
  broadcastAudio(audioBuffer) {
    this.wsConnections.forEach((ws) => {
      this.streamAudioToClient(ws, audioBuffer);
    });
  }
}

module.exports = TextToSpeechManager;