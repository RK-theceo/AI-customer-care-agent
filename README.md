# AI Customer Care Agent - Conversational Phone Agent

A production-ready conversational AI system that handles customer interactions over phone calls with natural language understanding, real-time speech processing, and intelligent dialogue management.

## 🎯 Features

### Core Capabilities
- **Real-Time STT**: Continuous speech-to-text conversion using OpenAI Whisper
- **Natural TTS**: ElevenLabs for human-like audio synthesis
- **Conversation Memory**: Full context management with entity extraction
- **Intelligent LLM**: Groq + OpenAI for rapid response generation
- **Dialogue State Management**: 8-state conversation flow engine
- **Interruption Handling**: Barge-in detection and graceful context switching
- **User Profile Extraction**: Automatic extraction of user information
- **Natural Language Processing**: Intent detection, sentiment analysis, topic tracking

### Technical Features
- WebSocket real-time bidirectional communication
- MongoDB conversation persistence
- Multi-turn context optimization
- Fallback mechanisms and error recovery
- Response diversity (prevents repetition)
- Silence detection and timeout handling
- Metrics and engagement scoring

## 📋 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND (React)                             │
│  Audio Capture │ Audio Playback │ Call UI │ Status Indicators  │
└────────────────────┬────────────────────────────────────────────┘
                     │ WebSocket
┌────────────────────▼────────────────────────────────────────────┐
│                    BACKEND (Node.js + Express)                  │
│  ┌──────────────────────────────────────────────────────────────┐
│  │ Call Session Manager (Orchestration)                         │
│  └──────────────────────────────────────────────────────────────┘
│         ▲         │           │           │           ▲
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐
│  │   STT      │ │ Dialogue   │ │  Context   │ │   TTS      │
│  │  Pipeline  │ │   State    │ │   Manager  │ │  Pipeline  │
│  └────────────┘ │   Engine   │ └────────────┘ └────────────┘
│                 └────────────┘
│  ┌──────────────────────────────────────────────────────────────┐
│  │   Conversation Memory Store (History + User Profile)        │
│  └──────────────────────────────────────────────────────────────┘
│  ┌──────────────────────────────────────────────────────────────┐
│  │         LLM Response Engine (Groq + OpenAI)                  │
│  └──────────────────────────────────────────────────────────────┘
└──────────────────────────────────────────────────────────────────┘
          ▲                    ▲                    ▲
      Groq API          OpenAI API        ElevenLabs API
```

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- MongoDB (local or cloud)
- API Keys:
  - Groq API key (https://console.groq.com)
  - OpenAI API key (https://platform.openai.com)
  - ElevenLabs API key (https://elevenlabs.io)

### Installation

1. **Clone and Setup**
```bash
git clone https://github.com/RK-theceo/AI-customer-care-agent.git
cd AI-customer-care-agent
```

2. **Backend Setup**
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your API keys
npm run dev
```

3. **Frontend Setup** (if using)
```bash
cd frontend
npm install
npm run dev
```

### Environment Variables

Create `.env` file in backend directory:

```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/ai-agent

# APIs
GROQ_API_KEY=your_groq_key
OPENAI_API_KEY=your_openai_key
ELEVENLABS_API_KEY=your_elevenlabs_key
ELEVENLABS_VOICE_ID=Rachel

# Agent Configuration
AGENT_NAME=Alex
AGENT_ROLE=Customer Care Representative
MAX_CONTEXT_MESSAGES=20
```

## 📝 API Reference

### REST Endpoints

#### Initiate Call
```bash
POST /api/call/initiate
Body: { clientData: {...} }
Response: { success: true, sessionId: "uuid" }
```

#### Send Message
```bash
POST /api/call/:sessionId/message
Body: { message: "user text" }
Response: { success: true, result: {...} }
```

#### End Call
```bash
POST /api/call/:sessionId/end
Body: { reason: "user_ended" }
Response: { success: true, result: {...} }
```

#### Get Statistics
```bash
GET /api/call/:sessionId/stats
Response: { success: true, stats: {...} }
```

### WebSocket Events

#### Client → Server
- `join-session`: { sessionId }
- `audio-chunk`: { sessionId, audioData }
- `barge-in`: { sessionId }
- `end-call`: { sessionId }

#### Server → Client
- `session-joined`: { sessionId, status }
- `agent-response`: { userMessage, agentResponse, audio }
- `call-ended`: { result }

## 🧠 Component Overview

### ConversationMemoryManager
Manages conversation history and context:
- Stores full message history
- Maintains optimized context window for LLM
- Extracts entities (name, email, phone, skills)
- Builds dynamic user profiles
- Calculates statistics

### DialogueStateEngine
Manages conversation flow with 8 states:
1. **GREETING** - Initial greeting and acknowledgment
2. **GATHERING_INFO** - Collecting user information
3. **ACTIVE_DISCUSSION** - Main conversation phase
4. **CLARIFICATION** - Clarifying points
5. **INTERRUPTION** - Handling user interruptions
6. **SILENCE** - Handling periods of no input
7. **CLOSING** - Wrapping up conversation
8. **ENDED** - Call terminated

### LLMResponseEngine
Generates intelligent responses:
- Uses Groq API for fast inference (<1s)
- Falls back to OpenAI GPT-4 if needed
- Prevents response repetition
- Adapts tone based on dialogue state
- Detects user sentiment

### SpeechToTextManager
Converts audio to text:
- Accumulates audio chunks
- Encodes to WAV format
- Uses OpenAI Whisper API
- Handles buffer management
- Provides confidence scores

### TextToSpeechManager
Converts text to natural speech:
- Uses ElevenLabs API
- Streams audio chunks
- Supports voice customization
- Estimates speech duration
- Handles fallback audio

### CallSessionManager
Orchestrates all components:
- Creates and manages sessions
- Coordinates message flow
- Handles errors and timeouts
- Persists data to MongoDB
- Emits WebSocket events

## 🔄 Conversation Flow

```
1. Client initiates call
   ↓
2. Agent greets with welcome message
   ↓
3. User responds (audio captured and converted to text)
   ↓
4. Intent is detected, state updates
   ↓
5. LLM generates contextual response
   ↓
6. Response converted to speech and streamed
   ↓
7. Steps 3-6 repeat until user ends call
   ↓
8. Conversation ends, data saved to database
```

## 💾 Data Storage

Each session stores:
- Full conversation history
- Extracted user profile
- Dialogue state tracking
- Performance metrics
- Error logs
- Timestamps and durations

## 🛡️ Error Handling

- LLM fallback chain: Groq → OpenAI → Emergency fallback
- Audio processing errors gracefully handled
- Network timeouts with reconnection logic
- Silent failures logged for debugging
- Graceful degradation for missing features

## 📊 Monitoring & Metrics

Track metrics for each session:
- Total turns in conversation
- Average response time
- User sentiment trend
- Engagement score
- Interruption frequency
- Silence duration

## 🔐 Security Considerations

- API keys stored in environment variables
- CORS configured for trusted origins
- Input validation on all endpoints
- Session isolation with UUIDs
- Audio data encryption in transit
- Database connection pooling

## 🚀 Performance Optimization

- Groq API for <1s response times
- WebSocket for real-time communication
- Audio chunking for streaming
- Context window optimization
- Message batching
- Connection pooling

## 📈 Future Enhancements

- Multi-language support
- Advanced NLP with transformers
- Customer sentiment analytics
- Call recording and playback
- Advanced scheduling
- Escalation to human agents
- Custom prompt templates
- A/B testing framework

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:
1. Fork the repository
2. Create a feature branch
3. Commit changes with clear messages
4. Push to branch and create pull request

## 📄 License

ISC License - See LICENSE file for details

## 📞 Support

For issues and questions:
- GitHub Issues: Report bugs and request features
- Email: support@example.com

## 🙏 Acknowledgments

- Groq for high-speed LLM inference
- OpenAI for GPT and Whisper models
- ElevenLabs for natural TTS
- MongoDB for data persistence
