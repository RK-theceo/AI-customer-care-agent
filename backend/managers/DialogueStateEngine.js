/**
 * DialogueStateEngine
 * 
 * Manages conversation flow and state transitions
 * Handles:
 * - Intent detection
 * - Turn-taking logic
 * - Silence and timeout handling
 * - Interruption detection
 * - Conversation progression
 */
class DialogueStateEngine {
  constructor(sessionId) {
    this.sessionId = sessionId;
    
    // State definitions
    this.states = {
      GREETING: 'greeting',
      GATHERING_INFO: 'gathering_info',
      ACTIVE_DISCUSSION: 'active_discussion',
      CLARIFICATION: 'clarification',
      INTERRUPTION: 'interruption',
      SILENCE: 'silence',
      CLOSING: 'closing',
      ENDED: 'ended',
    };

    // Current state
    this.currentState = this.states.GREETING;
    this.previousState = null;
    
    // State metadata
    this.stateStartTime = Date.now();
    this.stateData = {};
    
    // Tracking
    this.silenceCounter = 0;
    this.interruptionCounter = 0;
    this.clarificationCounter = 0;
    this.turnCount = 0;
  }

  /**
   * Detect intent from user message
   * Returns: { intent, confidence, entities }
   */
  detectIntent(userMessage) {
    const message = userMessage.toLowerCase();

    // Intent patterns
    const intents = {
      greeting: {
        patterns: ['hello', 'hi', 'hey', 'good morning', 'good afternoon'],
        confidence: 0.95,
      },
      question: {
        patterns: ['?', 'what', 'how', 'why', 'when', 'where', 'who'],
        confidence: 0.9,
      },
      affirmation: {
        patterns: ['yes', 'yeah', 'sure', 'okay', 'ok', 'correct', 'true'],
        confidence: 0.85,
      },
      negation: {
        patterns: ['no', 'nope', 'never', 'not', 'don\'t', 'doesn\'t'],
        confidence: 0.85,
      },
      clarification_needed: {
        patterns: ['repeat', 'again', 'what', 'didn\'t understand', 'confusing'],
        confidence: 0.8,
      },
      farewell: {
        patterns: ['bye', 'goodbye', 'thanks', 'thank you', 'end call'],
        confidence: 0.9,
      },
    };

    let detectedIntent = null;
    let highestConfidence = 0;

    for (const [intent, data] of Object.entries(intents)) {
      for (const pattern of data.patterns) {
        if (message.includes(pattern)) {
          if (data.confidence > highestConfidence) {
            highestConfidence = data.confidence;
            detectedIntent = intent;
          }
        }
      }
    }

    return {
      intent: detectedIntent || 'statement',
      confidence: highestConfidence,
    };
  }

  /**
   * Transition to new state based on current context
   */
  transitionToState(newState, data = {}) {
    this.previousState = this.currentState;
    this.currentState = newState;
    this.stateStartTime = Date.now();
    this.stateData = data;

    console.log(
      `[${this.sessionId}] State transition: ${this.previousState} -> ${this.currentState}`
    );
  }

  /**
   * Handle user message and update state
   */
  processUserMessage(userMessage, metadata = {}) {
    const intent = this.detectIntent(userMessage);
    this.turnCount++;

    // State-specific handling
    switch (this.currentState) {
      case this.states.GREETING:
        if (intent.intent === 'greeting' || intent.intent === 'statement') {
          this.transitionToState(this.states.GATHERING_INFO, {
            lastIntent: intent.intent,
          });
        }
        break;

      case this.states.GATHERING_INFO:
        if (intent.intent === 'question' || intent.intent === 'statement') {
          this.transitionToState(this.states.ACTIVE_DISCUSSION, {
            topic: this._extractTopic(userMessage),
          });
        }
        break;

      case this.states.ACTIVE_DISCUSSION:
        if (intent.intent === 'clarification_needed') {
          this.transitionToState(this.states.CLARIFICATION, {
            clarificationTopic: this.stateData.topic,
          });
          this.clarificationCounter++;
        } else if (intent.intent === 'farewell') {
          this.transitionToState(this.states.CLOSING, {});
        }
        break;

      case this.states.CLARIFICATION:
        // Return to active discussion after clarification
        this.transitionToState(this.states.ACTIVE_DISCUSSION, {
          topic: this.stateData.clarificationTopic,
        });
        break;

      case this.states.CLOSING:
        if (intent.intent === 'farewell' || intent.intent === 'affirmation') {
          this.transitionToState(this.states.ENDED, {});
        }
        break;
    }

    return {
      state: this.currentState,
      intent: intent,
      turnCount: this.turnCount,
    };
  }

  /**
   * Handle silence (no user input for timeout period)
   */
  handleSilence() {
    this.silenceCounter++;

    if (this.silenceCounter >= 2) {
      // Too much silence, move to closing
      this.transitionToState(this.states.CLOSING, {
        reason: 'silence',
      });
    } else {
      this.transitionToState(this.states.SILENCE, {
        duration: this.silenceCounter,
      });
    }
  }

  /**
   * Handle user interruption (barge-in)
   */
  handleInterruption() {
    this.interruptionCounter++;
    this.transitionToState(this.states.INTERRUPTION, {
      count: this.interruptionCounter,
    });
  }

  /**
   * Extract topic from message (simple heuristic)
   */
  _extractTopic(message) {
    const words = message.split(' ');
    return words.slice(0, 3).join(' ');
  }

  /**
   * Get current state info
   */
  getCurrentStateInfo() {
    const duration = Math.floor((Date.now() - this.stateStartTime) / 1000);
    
    return {
      state: this.currentState,
      duration,
      data: this.stateData,
      statistics: {
        turnCount: this.turnCount,
        silenceCount: this.silenceCounter,
        interruptionCount: this.interruptionCounter,
        clarificationCount: this.clarificationCounter,
      },
    };
  }

  /**
   * Should agent speak now?
   * Check if it's appropriate to generate response
   */
  shouldAgentSpeak() {
    const allowedStates = [
      this.states.GREETING,
      this.states.GATHERING_INFO,
      this.states.ACTIVE_DISCUSSION,
      this.states.CLARIFICATION,
      this.states.INTERRUPTION,
      this.states.CLOSING,
    ];

    return allowedStates.includes(this.currentState);
  }

  /**
   * Get suggested follow-up based on state
   */
  getSuggestedFollowUp() {
    const suggestions = {
      [this.states.GREETING]: 'Ask for their name and initial information',
      [this.states.GATHERING_INFO]: 'Continue gathering relevant information',
      [this.states.ACTIVE_DISCUSSION]: 'Ask follow-up questions on current topic',
      [this.states.CLARIFICATION]: 'Rephrase previous point more clearly',
      [this.states.INTERRUPTION]: 'Acknowledge interruption and ask to proceed',
      [this.states.SILENCE]: 'Prompt user to continue or confirm they\'re still there',
      [this.states.CLOSING]: 'Summarize and thank them for their time',
    };

    return suggestions[this.currentState] || '';
  }
}

module.exports = DialogueStateEngine;