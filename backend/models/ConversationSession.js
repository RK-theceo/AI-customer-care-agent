const mongoose = require('mongoose');

const conversationSessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
  },
  
  // Call metadata
  callStartTime: {
    type: Date,
    default: Date.now,
  },
  callEndTime: {
    type: Date,
  },
  callDuration: {
    type: Number,
    default: 0,
  },
  callStatus: {
    type: String,
    enum: ['active', 'on-hold', 'ended', 'error'],
    default: 'active',
  },

  // Conversation context
  conversationHistory: [
    {
      role: {
        type: String,
        enum: ['user', 'assistant', 'system'],
      },
      content: String,
      timestamp: {
        type: Date,
        default: Date.now,
      },
      metadata: {
        duration: Number,
        confidence: Number,
        emotions: [String],
        entities: [String],
      },
    },
  ],

  // User profile (extracted from conversation)
  extractedUserProfile: {
    name: String,
    email: String,
    phone: String,
    company: String,
    title: String,
    skills: [String],
    experience: String,
    customFields: mongoose.Schema.Types.Mixed,
  },

  // Dialogue state
  dialogueState: {
    currentTopic: String,
    lastIntentDetected: String,
    interruptionCount: Number,
    silenceCount: Number,
    clarificationRequested: Boolean,
    clarificationTopic: String,
  },

  // Performance metrics
  metrics: {
    totalTurns: Number,
    averageResponseTime: Number,
    userSentimentTrend: [String],
    engagementScore: Number,
  },

  // Settings
  agentSettings: {
    agentName: String,
    agentRole: String,
    personality: String,
    language: String,
  },

  // System notes
  internalNotes: String,
  errorLog: [String],
});

module.exports = mongoose.model('ConversationSession', conversationSessionSchema);