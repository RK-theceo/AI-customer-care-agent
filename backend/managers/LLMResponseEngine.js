const Groq = require('groq-sdk');
const { OpenAI } = require('openai');

/**
 * LLMResponseEngine
 * 
 * Generates intelligent, natural responses using LLMs
 * Handles:
 * - Response generation with context
 * - Intent-based reply selection
 * - Follow-up question generation
 * - Natural language variation (avoid repetition)
 * - Emotional awareness
 */
class LLMResponseEngine {
  constructor(sessionId) {
    this.sessionId = sessionId;

    // Initialize LLM clients
    this.groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Response patterns (to avoid repetition)
    this.responsePatterns = new Set();
    this.previousResponses = [];
  }

  /**
   * Generate response based on context and dialogue state
   * This is the core LLM interaction
   */
  async generateResponse(contextMessages, dialogueState, userIntent) {
    try {
      // Build system prompt with current state
      const systemPrompt = this._buildDynamicSystemPrompt(
        dialogueState,
        userIntent
      );

      // Update system message in context
      contextMessages[0].content = systemPrompt;

      // Call Groq API (faster for real-time)
      const response = await this.groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: contextMessages,
        temperature: 0.7, // Balance between consistency and creativity
        max_tokens: 150, // Keep responses concise for speech
        top_p: 0.9,
      });

      const generatedText = response.choices[0].message.content;

      // Store response to avoid repetition
      this._recordResponse(generatedText);

      return {
        text: generatedText,
        model: 'groq',
        tokensUsed: response.usage.total_tokens,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error(
        `[${this.sessionId}] Error in Groq response generation:`,
        error
      );

      // Fallback to OpenAI
      return this._fallbackToOpenAI(contextMessages, dialogueState);
    }
  }

  /**
   * Build dynamic system prompt based on dialogue state
   */
  _buildDynamicSystemPrompt(dialogueState, userIntent) {
    let stateGuidance = '';

    // Customize guidance based on dialogue state
    if (dialogueState.state === 'greeting') {
      stateGuidance =
        'Warmly greet the user and ask for their name and what brings them here.';
    } else if (dialogueState.state === 'gathering_info') {
      stateGuidance =
        'Ask specific, relevant questions to understand their situation better.';
    } else if (dialogueState.state === 'active_discussion') {
      stateGuidance =
        'Provide insightful responses and ask thoughtful follow-up questions.';
    } else if (dialogueState.state === 'clarification') {
      stateGuidance =
        'Rephrase your previous point in a different, clearer way.';
    } else if (dialogueState.state === 'closing') {
      stateGuidance = 'Summarize the conversation and provide a graceful closing.';
    }

    return `You are ${process.env.AGENT_NAME}, a ${process.env.AGENT_ROLE}.

CURRENT GUIDANCE: ${stateGuidance}

COMMUNICATION STYLE:
- Sound natural and conversational, like you're speaking on a phone call
- Keep responses concise (1-3 sentences typically, max 4)
- Avoid robotic language and over-explanation
- Use appropriate conversational fillers ("Well, ", "Actually, ", "So, ")
- Ask clarifying questions when needed
- Remember context from earlier in the conversation
- Show genuine interest in the user
- Adapt tone to match user's energy

USER INTENT: ${userIntent.intent} (confidence: ${userIntent.confidence})

RESPONSE REQUIREMENTS:
1. Natural and conversational
2. Specific to current context
3. Never repeat previous responses
4. Ask follow-up questions when appropriate
5. Handle objections gracefully
6. Maintain topic continuity`;
  }

  /**
   * Fallback to OpenAI if Groq fails
   */
  async _fallbackToOpenAI(contextMessages, dialogueState) {
    try {
      contextMessages[0].content = this._buildDynamicSystemPrompt(
        dialogueState,
        {}
      );

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: contextMessages,
        temperature: 0.7,
        max_tokens: 150,
      });

      const generatedText = response.choices[0].message.content;
      this._recordResponse(generatedText);

      return {
        text: generatedText,
        model: 'openai-fallback',
        tokensUsed: response.usage.total_tokens,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error(
        `[${this.sessionId}] Error in fallback OpenAI response:`,
        error
      );
      return this._getEmergencyResponse();
    }
  }

  /**
   * Record response to prevent repetition
   */
  _recordResponse(response) {
    this.previousResponses.push(response);

    // Keep only last 10 responses
    if (this.previousResponses.length > 10) {
      this.previousResponses.shift();
    }

    // Add to pattern set
    const pattern = response.split(' ').slice(0, 5).join(' ');
    this.responsePatterns.add(pattern);
  }

  /**
   * Get emergency fallback response
   */
  _getEmergencyResponse() {
    const fallbacks = [
      "I appreciate you sharing that. Can you tell me more?",
      "That's interesting. What else would you like to discuss?",
      "I understand. How can I help you further?",
      "Thank you for that information. Is there anything else?",
    ];

    return {
      text: fallbacks[Math.floor(Math.random() * fallbacks.length)],
      model: 'fallback',
      tokensUsed: 0,
      timestamp: Date.now(),
    };
  }

  /**
   * Detect emotion/sentiment in user message
   */
  async detectSentiment(userMessage) {
    const sentimentPatterns = {
      positive: [
        'great',
        'good',
        'excellent',
        'wonderful',
        'perfect',
        'awesome',
      ],
      negative: ['bad', 'terrible', 'awful', 'horrible', 'disappointing'],
      neutral: ['okay', 'fine', 'alright', 'so-so'],
      frustrated: ['ugh', 'frustrated', 'annoyed', 'irritated'],
      confused: ['confused', 'unclear', 'understand', 'confusing'],
    };

    const message = userMessage.toLowerCase();
    let sentiment = 'neutral';
    let confidence = 0.5;

    for (const [sent, patterns] of Object.entries(sentimentPatterns)) {
      for (const pattern of patterns) {
        if (message.includes(pattern)) {
          sentiment = sent;
          confidence = 0.85;
          break;
        }
      }
    }

    return { sentiment, confidence };
  }
}

module.exports = LLMResponseEngine;