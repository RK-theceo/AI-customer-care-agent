const { OpenAI } = require('openai');

/**
 * SpeechToTextManager
 * 
 * Converts user audio to text in real-time
 * Handles:
 * - Audio streaming
 * - Buffer management
 * - Confidence scoring
 * - Error handling
 */
class SpeechToTextManager {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Audio buffer management
    this.audioBuffer = Buffer.alloc(0);
    this.sampleRate = 16000;
    this.channelCount = 1;
    this.isProcessing = false;
  }

  /**
   * Add audio data to buffer
   * Called continuously as audio streams in
   */
  addAudioData(audioChunk) {
    this.audioBuffer = Buffer.concat([this.audioBuffer, audioChunk]);

    // Process if buffer exceeds threshold (e.g., 1 second of audio)
    const bufferDurationMs = (this.audioBuffer.length / this.sampleRate) * 1000;
    if (bufferDurationMs >= 1000 && !this.isProcessing) {
      return this._processAudioBuffer();
    }

    return null;
  }

  /**
   * Process accumulated audio buffer
   * Convert audio to text using Whisper
   */
  async _processAudioBuffer() {
    if (this.audioBuffer.length === 0) {
      return null;
    }

    this.isProcessing = true;

    try {
      // Convert raw audio to WAV format for Whisper
      const wavBuffer = this._encodeWAV(this.audioBuffer);

      // Create file-like object for OpenAI API
      const blob = new Blob([wavBuffer], { type: 'audio/wav' });
      const file = new File([blob], 'audio.wav');

      // Call Whisper STT
      const response = await this.openai.audio.transcriptions.create({
        file: file,
        model: 'whisper-1',
        language: 'en',
        temperature: 0.0,
      });

      // Clear processed buffer
      this.audioBuffer = Buffer.alloc(0);
      this.isProcessing = false;

      return {
        text: response.text,
        confidence: 0.95, // Whisper doesn't provide explicit confidence
        timestamp: Date.now(),
        duration: this._calculateAudioDuration(wavBuffer),
      };
    } catch (error) {
      console.error(
        `[${this.sessionId}] STT error:`,
        error.message
      );
      this.isProcessing = false;
      return null;
    }
  }

  /**
   * Encode PCM audio data to WAV format
   */
  _encodeWAV(pcmData) {
    const numChannels = 1;
    const sampleRate = 16000;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = pcmData.length;

    const buffer = Buffer.alloc(44 + dataSize);
    const view = new DataView(buffer.buffer);

    // WAV header
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    // Copy PCM data
    for (let i = 0; i < dataSize; i++) {
      view.setUint8(44 + i, pcmData[i]);
    }

    return buffer;
  }

  /**
   * Calculate duration of audio data
   */
  _calculateAudioDuration(wavBuffer) {
    // WAV format: data starts at offset 44
    const dataSize = wavBuffer.length - 44;
    const durationMs = (dataSize / 32000) * 1000; // 16-bit mono at 16kHz
    return durationMs;
  }

  /**
   * Flush remaining audio
   */
  async flushBuffer() {
    if (this.audioBuffer.length > 0) {
      return this._processAudioBuffer();
    }
    return null;
  }

  /**
   * Reset manager for new call
   */
  reset() {
    this.audioBuffer = Buffer.alloc(0);
    this.isProcessing = false;
  }
}

module.exports = SpeechToTextManager;