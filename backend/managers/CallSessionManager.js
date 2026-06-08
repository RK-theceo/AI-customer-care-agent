const { v4: uuidv4 } = require('uuid');
const ConversationMemoryManager = require('./ConversationMemoryManager');
const DialogueStateEngine = require('./DialogueStateEngine');
const LLMResponseEngine = require('./LLMResponseEngine');
const SpeechToTextManager = require('./SpeechToTextManager');
const TextToSpeechManager = require('./TextToSpeechManager');
const ConversationSession = require('../models/ConversationSession');

/**
 * CallSessionManager
 * 
 * Orchestrates entire call session
 * Manages all components working together:
 * - Session lifecycle
 * - Component coordination
 * - Message flow
 * - Error handling
 */
class CallSessionManager {
  constructor(io) {
    this.io = io;
    this.sessions = new Map();
  }

  /**
   * Create new call session
   */
  async createSession(clientData = {}) {
    const sessionId = uuidv4();

    const session = {
      sessionId,
      clientData,
      createdAt: Date.now(),
      status: 'active',

      // Initialize managers
      memory: new ConversationMemoryManager(
        sessionId,
        parseInt(process.env.MAX_CONTEXT_MESSAGES) || 20
      ),
      dialogueState: new DialogueStateEngine(sessionId),
      llmEngine: new LLMResponseEngine(sessionId),
      sttManager: new SpeechToTextManager(sessionId),
      ttsManager: new TextToSpeechManager(sessionId),

      // Tracking
      turnCount: 0,
      lastActivityTime: Date.now(),
      silenceStartTime: null,
    };

    this.sessions.set(sessionId, session);

    // Save to database
    try {
      const dbSession = new ConversationSession({
        sessionId,
        callStartTime: new Date(),
        callStatus: 'active',
        agentSettings: {
          agentName: process.env.AGENT_NAME,
          agentRole: process.env.AGENT_ROLE,
          personality: process.env.AGENT_PERSONALITY,
        },
      });

      await dbSession.save();
    } catch (dbError) {
      console.error(`[${sessionId}] Database error:`, dbError);
    }

    console.log(`[${sessionId}] New session created`);
    return sessionId;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  /**
   * Process incoming audio from user
   */
  async processUserAudio(sessionId, audioChunk) {
    const session = this.getSession(sessionId);
    if (!session) {
      console.error(`Session ${sessionId} not found`);
      return null;
    }

    try {
      session.lastActivityTime = Date.now();
      session.silenceStartTime = null; // Reset silence timer

      // Convert audio to text
      const sttResult = await session.sttManager.addAudioData(audioChunk);

      if (sttResult) {
        return await this.processUserMessage(sessionId, sttResult.text);
      }
    } catch (error) {
      console.error(`[${sessionId}] Error processing audio:`, error);
      return null;
    }
  }

  /**
   * Process user text message
   */
  async processUserMessage(sessionId, userText) {
    const session = this.getSession(sessionId);
    if (!session) return null;

    try {
      // Add to conversation memory
      session.memory.addMessage('user', userText, {
        confidence: 0.95,
      });

      // Extract entities
      session.memory.extractEntities(userText, 'user');

      // Detect intent
      const intent = session.dialogueState.detectIntent(userText);

      // Update dialogue state
      const stateUpdate = session.dialogueState.processUserMessage(
        userText,
        { intent }
      );

      // Generate agent response
      const response = await this._generateResponse(session, intent);

      // Add agent response to memory
      session.memory.addMessage('assistant', response.text);

      // Convert response to speech
      const audio = await session.ttsManager.synthesizeText(response.text);

      // Prepare output
      const output = {
        sessionId,
        userMessage: userText,
        agentResponse: response.text,
        audio: audio.audio ? audio.audio.toString('base64') : '',
        dialogueState: stateUpdate,
        timestamp: Date.now(),
      };

      // Emit via WebSocket if client connected
      this.io.to(sessionId).emit('agent-response', output);

      return output;
    } catch (error) {
      console.error(`[${sessionId}] Error processing message:`, error);
      return this._handleError(session, error);
    }
  }

  /**
   * Generate response using LLM
   */
  async _generateResponse(session, userIntent) {
    try {
      const contextMessages = session.memory.getContextForLLM();
      const dialogueState = session.dialogueState.getCurrentStateInfo();

      // Check if agent should speak
      if (!session.dialogueState.shouldAgentSpeak()) {
        return {
          text: "I'm listening...",
          confidence: 1.0,
        };
      }

      // Generate response
      const response = await session.llmEngine.generateResponse(
        contextMessages,
        dialogueState,
        userIntent
      );

      return response;
    } catch (error) {
      console.error(`Error generating response:`, error);
      return {
        text: "I'm sorry, let me try that again. Could you repeat what you said?",
        confidence: 0.5,
      };
    }
  }

  /**
   * Handle silence (no user input for timeout)
   */
  async handleSilenceTimeout(sessionId) {
    const session = this.getSession(sessionId);
    if (!session) return;

    session.dialogueState.handleSilence();

    const stateInfo = session.dialogueState.getCurrentStateInfo();

    // Generate prompt based on silence state
    let prompt = '';
    if (stateInfo.data.duration === 1) {
      prompt = 'Are you still there?';
    } else if (stateInfo.data.duration >= 2) {
      prompt = "I haven't heard from you. Ending the call now.";
      await this.endSession(sessionId, 'silence');
      return;
    }

    // Convert to speech and send
    const audio = await session.ttsManager.synthesizeText(prompt);
    session.memory.addMessage('assistant', prompt);

    this.io.to(sessionId).emit('agent-response', {
      text: prompt,
      audio: audio.audio ? audio.audio.toString('base64') : '',
      isPrompt: true,
    });
  }

  /**
   * Handle user interruption (barge-in)
   */
  handleInterruption(sessionId) {
    const session = this.getSession(sessionId);
    if (!session) return;

    session.dialogueState.handleInterruption();
    console.log(`[${sessionId}] User interrupted agent`);
  }

  /**
   * End call session gracefully
   */
  async endSession(sessionId, reason = 'user_ended') {
    const session = this.getSession(sessionId);
    if (!session) return;

    try {
      const callDuration = Date.now() - session.createdAt;

      // Generate closing summary
      const transcript = session.memory.getFullTranscript();
      const stats = session.memory.getStats();

      // Update database
      try {
        await ConversationSession.findOneAndUpdate(
          { sessionId },
          {
            callEndTime: new Date(),
            callDuration,
            callStatus: 'ended',
            conversationHistory: session.memory.conversationHistory,
            extractedUserProfile: session.memory.userProfile,
            internalNotes: `Call ended: ${reason}`,
          }
        );
      } catch (dbError) {
        console.error(`[${sessionId}] Database update error:`, dbError);
      }

      // Cleanup
      this.sessions.delete(sessionId);

      console.log(
        `[${sessionId}] Session ended (${reason}) - Duration: ${callDuration}ms - Stats:`,
        stats
      );

      return {
        sessionId,
        reason,
        duration: callDuration,
        stats,
        transcript,
      };
    } catch (error) {
      console.error(`[${sessionId}] Error ending session:`, error);
    }
  }

  /**
   * Handle errors during call
   */
  async _handleError(session, error) {
    console.error(`[${session.sessionId}] Session error:`, error);

    const errorResponse = {
      text: "I encountered a technical issue. Let me try again.",
      confidence: 0.3,
      isError: true,
    };

    session.memory.addMessage('system', `Error occurred: ${error.message}`);

    return errorResponse;
  }

  /**
   * Get session statistics
   */
  getSessionStats(sessionId) {
    const session = this.getSession(sessionId);
    if (!session) return null;

    return {
      sessionId,
      uptime: Date.now() - session.createdAt,
      memory: session.memory.getStats(),
      dialogueState: session.dialogueState.getCurrentStateInfo(),
    };
  }
}

module.exports = CallSessionManager;