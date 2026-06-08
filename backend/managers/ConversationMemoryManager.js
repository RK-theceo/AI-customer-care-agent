/**
 * ConversationMemoryManager
 * 
 * Maintains and manages conversation history, context, and user profile
 * throughout the call lifecycle. Handles:
 * - Message history with metadata
 * - Context window optimization
 * - User profile extraction
 * - Conversation summarization
 * - Entity tracking
 */
class ConversationMemoryManager {
  constructor(sessionId, maxContextMessages = 20) {
    this.sessionId = sessionId;
    this.maxContextMessages = maxContextMessages;
    
    // Core conversation state
    this.conversationHistory = [];
    this.userProfile = {};
    this.extractedEntities = {};
    this.conversationSummary = '';
    this.contextWindow = [];
    
    // Performance tracking
    this.turnCount = 0;
    this.totalTokens = 0;
    this.startTime = Date.now();
  }

  /**
   * Add a message to conversation history
   * Maintains full history and optimized context window
   */
  addMessage(role, content, metadata = {}) {
    const message = {
      role,
      content,
      timestamp: Date.now(),
      metadata,
      turnIndex: this.turnCount,
    };

    this.conversationHistory.push(message);
    this.turnCount++;

    // Update context window (keep most recent messages)
    this._updateContextWindow();

    return message;
  }

  /**
   * Manage context window for LLM input
   * Keeps recent messages within token limit
   */
  _updateContextWindow() {
    const systemMessage = {
      role: 'system',
      content: this._buildSystemPrompt(),
    };

    // Start with system message
    this.contextWindow = [systemMessage];

    // Add conversation history (most recent first for priority)
    const recentMessages = this.conversationHistory.slice(
      Math.max(0, this.conversationHistory.length - this.maxContextMessages)
    );

    this.contextWindow.push(...recentMessages);
  }

  /**
   * Build system prompt with current context
   */
  _buildSystemPrompt() {
    return `You are ${process.env.AGENT_NAME}, a ${process.env.AGENT_ROLE}.

PERSONALITY TRAITS:
- ${process.env.AGENT_PERSONALITY}
- Speak naturally, not robotic
- Be conversational and engaging
- Ask clarifying questions when needed
- Remember previous information from this call
- Adapt responses based on user reactions

USER PROFILE:
${JSON.stringify(this.userProfile, null, 2)}

CONVERSATION STATE:
- Topics discussed: ${Object.keys(this.extractedEntities).join(', ') || 'None yet'}
- Call duration: ${Math.floor((Date.now() - this.startTime) / 1000)}s
- Turn count: ${this.turnCount}

GUIDELINES:
1. Maintain natural conversation flow
2. Ask follow-up questions to gather information
3. Show empathy and understanding
4. Provide specific, relevant responses
5. If user seems confused, clarify or ask different way
6. Handle objections professionally
7. Use previous context to inform responses
8. End gracefully when appropriate`;
  }

  /**
   * Get optimized context for LLM
   * Returns formatted messages ready for API call
   */
  getContextForLLM() {
    return this.contextWindow;
  }

  /**
   * Extract and store entities from user/system messages
   * Used to build user profile
   */
  extractEntities(text, messageRole = 'user') {
    const patterns = {
      email: /[\w\.-]+@[\w\.-]+\.\w+/g,
      phone: /(?:\+?1[-\.\s]?)?\(?[0-9]{3}\)?[-\.\s]?[0-9]{3}[-\.\s]?[0-9]{4}/g,
      name: /(?:my name is|i'm|i am)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
      skills: /(?:skilled in|proficient in|experienced with|know)\s+([^,\.]+)/gi,
    };

    for (const [type, pattern] of Object.entries(patterns)) {
      const matches = text.match(pattern);
      if (matches) {
        if (!this.extractedEntities[type]) {
          this.extractedEntities[type] = [];
        }
        this.extractedEntities[type].push(...matches);
      }
    }

    // Update user profile
    this._updateUserProfile();
  }

  /**
   * Update user profile with extracted entities
   */
  _updateUserProfile() {
    if (this.extractedEntities.email) {
      this.userProfile.email = this.extractedEntities.email[0];
    }
    if (this.extractedEntities.phone) {
      this.userProfile.phone = this.extractedEntities.phone[0];
    }
    if (this.extractedEntities.name) {
      this.userProfile.name = this.extractedEntities.name[0];
    }
    if (this.extractedEntities.skills) {
      this.userProfile.skills = [...new Set(this.extractedEntities.skills)];
    }
  }

  /**
   * Get full conversation transcript
   */
  getFullTranscript() {
    return this.conversationHistory
      .map((m) => `[${new Date(m.timestamp).toISOString()}] ${m.role}: ${m.content}`)
      .join('\n');
  }

  /**
   * Get conversation statistics
   */
  getStats() {
    return {
      totalTurns: this.turnCount,
      messageCount: this.conversationHistory.length,
      callDuration: Math.floor((Date.now() - this.startTime) / 1000),
      userProfileCompleteness: Object.keys(this.userProfile).length,
      extractedEntities: this.extractedEntities,
    };
  }
}

module.exports = ConversationMemoryManager;