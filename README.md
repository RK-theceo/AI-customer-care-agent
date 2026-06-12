# 🤖 AI Customer Care Agent - 100% FREE TIER Edition

> **Production-ready conversational AI system for customer support - ZERO COST. No paid tokens. No credit cards required.**

A real-time conversational phone agent that handles customer interactions with natural language understanding, real-time speech processing, and intelligent dialogue management. **Completely free using only generous free-tier APIs.**

## ✨ Key Features

- ✅ **100% FREE**: Uses only free-tier APIs with zero paid services
- ✅ **Real-Time STT**: Groq Whisper (included in free tier)
- ✅ **Fast LLM**: Groq API (30 req/min free, <500ms response time)
- ✅ **Natural TTS**: Google Cloud TTS (1M chars/month free)
- ✅ **No Credit Card Required**: All services have truly free tiers
- ✅ **Low Latency**: Streaming where supported, optimized for real-time conversation
- ✅ **Conversation Memory**: Full context management with entity extraction
- ✅ **Dialogue State Management**: 8-state conversation flow engine
- ✅ **Local Database**: SQLite for data persistence (no cloud DB needed)

## 💰 Cost Breakdown

| Component | Free Tier | Notes |
|-----------|-----------|-------|
| **Groq LLM** | 30 req/min | ~1,800 calls/hour, <500ms latency |
| **Groq Whisper STT** | Included with LLM | No separate quota |
| **Google Cloud TTS** | 1M chars/month | ~3,500 calls, no credit card |
| **Database** | Local SQLite | 100% free, stored locally |
| **Server** | Free tier | Railway/Render/Vercel free |
| **Total Monthly Cost** | **$0.00** | For <100 calls/month |

## 🚀 Quick Start (10 minutes)

### Prerequisites

- Node.js 16+
- **Free API Keys** (no credit cards):
  - Groq: https://console.groq.com/keys (30 seconds)
  - Google Cloud TTS: https://cloud.google.com/text-to-speech (3-5 minutes)

### Installation

1. **Clone repository**
   ```bash
   git clone https://github.com/RK-theceo/AI-customer-care-agent.git
   cd AI-customer-care-agent/backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Get free API keys** (see setup guide below)

4. **Configure environment**
   ```bash
   cp .env.example .env
   nano .env  # Add your API keys
   ```

5. **Run server**
   ```bash
   npm run dev
   ```

   Expected output:
   ```
   🚀 Server running on port 5000
   📱 WebSocket server ready
   🤖 Agent: Alex (Customer Care Representative)
   ```

## 🔑 Getting Free API Keys

### Groq API (30 seconds)

1. Go to https://console.groq.com/keys
2. Sign up (email, GitHub, or Google)
3. Click "Create API Key"
4. Copy key (starts with `gsk_`)
5. Add to `.env`: `GROQ_API_KEY=gsk_xxxxx`

**Free tier:** 30 requests/minute (renewable daily)

### Google Cloud TTS (3-5 minutes)

1. Go to https://cloud.google.com/text-to-speech
2. Click "Get Started"
3. Create new project (no organization)
4. Enable Text-to-Speech API
5. Go to APIs & Services → Credentials
6. Click "Create Credentials" → "API Key"
7. Copy key (starts with `AIzaSy`)
8. Add to `.env`: `GOOGLE_CLOUD_TTS_API_KEY=AIzaSy_xxxxx`

**Free tier:** 1,000,000 characters/month (no credit card)

## 📋 Architecture

```
┌─────────────────────────────────────────────────────────┐
│              FRONTEND (React/WebSocket)                 │
│         Audio Capture & Playback                        │
└─────���───────────────┬───────────────────────────────────┘
                      │ WebSocket
┌─────────────────────▼───────────────────────────────────┐
│           BACKEND (Node.js + Express)                   │
│  ┌──────────────────────────────────────────────────┐  │
│  │     Call Session Manager                         │  │
│  │  (Orchestrates all components)                   │  │
│  └──────────────────────────────────────────────────┘  │
│     ▲              ▲              ▲              ▲      │
│  ┌──────┐   ┌────────────┐   ┌────────┐   ┌──────────┐ │
│  │STT   │   │ Dialogue   │   │Context │   │ TTS      │ │
│  │Groq  │   │ State      │   │Manager │   │ Google   │ │
│  │      │   │ Engine     │   │        │   │ Cloud    │ │
│  └──────┘   └────────────┘   └────────┘   └──────────┘ │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │  LLM Engine (Groq - 30 req/min FREE)            │  │
│  │  • Rate limiting                                 │  │
│  │  • Fallback responses                            │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Memory Store (SQLite - Local)                   │  │
│  │  • Conversation history                          │  │
│  │  • User profiles                                 │  │
│  │  • Call metrics                                  │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
           │                │                │
        Groq API      Google Cloud        SQLite
        (Free)         TTS (Free)         (Local)
```

## 📊 Free Tier Limits & Best Practices

### Groq LLM (30 requests/minute)

**What counts:** Each LLM response = 1 request  
**STT:** Included, no separate count  

**For 100 customer calls/month:** ✅ **NO ISSUES**
- Average: 5-10 exchanges per call
- Total: 500-1,000 LLM calls/month
- Limit: 1,800 calls/hour = 43,200/day

### Google Cloud TTS (1,000,000 chars/month)

**What counts:** Each character synthesized  
**Average:** 300 chars per response  

**For 100 customer calls/month:** ✅ **FULLY FREE**
- 100 calls × 10 exchanges × 300 chars = 300,000 chars
- Limit: 1,000,000 chars/month
- Remaining: 700,000 chars (safe)

### Quota Monitoring

The system logs all API usage:

```bash
[session-123] ✅ Groq call (5/30 used)
[session-123] ✅ Google TTS: "How can I help?" (45 chars, 325000/1000000 quota)
[session-123] 💾 TTS Cache hit (saving quota)
[session-123] ⚠️  Approaching TTS quota: 85.5%
```

## 🧠 Component Overview

### LLMResponseEngine (Groq - FREE)
- Uses Groq's fast LLM inference (<500ms)
- 30 req/min free tier with rate limiting
- Automatic fallback when limited
- Emergency responses (no API call)
- Sentiment detection (local)

### SpeechToTextManager (Groq Whisper - FREE)
- Converts audio to text
- Included in Groq free tier
- Accumulates ~1 second audio
- 95%+ accuracy
- WAV encoding

### TextToSpeechManager (Google Cloud - FREE)
- Converts text to natural speech
- 1M chars/month free tier
- Audio caching to save quota
- Quota tracking with warnings
- MP3 format (smallest size)

### ConversationMemoryManager
- Stores conversation history locally
- Manages context window (20 messages default)
- Extracts entities (name, email, phone)
- Builds user profiles
- Calculates statistics

### DialogueStateEngine
8-state conversation flow:
1. GREETING - Initial greeting
2. GATHERING_INFO - Collect information
3. ACTIVE_DISCUSSION - Main conversation
4. CLARIFICATION - Clarify points
5. INTERRUPTION - Handle barge-in
6. SILENCE - Handle timeout
7. CLOSING - Wrap up
8. ENDED - Call terminated

## 🚀 Deployment (Railway - Easiest)

Railway offers **$5/month free credits** (enough for hobby projects).

1. **Push to GitHub**
   ```bash
   git push origin main
   ```

2. **Deploy to Railway**
   - Go to https://railway.app
   - Login with GitHub
   - New Project → Deploy from GitHub
   - Select this repo
   - Railway auto-detects Node.js

3. **Add environment variables** in Railway dashboard:
   ```
   GROQ_API_KEY=gsk_xxxxx
   GOOGLE_CLOUD_TTS_API_KEY=AIzaSy_xxxxx
   NODE_ENV=production
   ```

4. **Your app is live!**
   ```
   https://ai-customer-care-agent.railway.app
   ```

See **DEPLOYMENT.md** for Render, Vercel, Docker options.

## 📚 API Reference

### Initiate Call
```bash
POST /api/call/initiate
Body: { clientData: { name: "John" } }
Response: { success: true, sessionId: "uuid" }
```

### Send Message
```bash
POST /api/call/:sessionId/message
Body: { message: "I need help" }
Response: {
  success: true,
  result: {
    userMessage: "I need help",
    agentResponse: "I'm happy to help...",
    audio: "base64-mp3"
  }
}
```

### End Call
```bash
POST /api/call/:sessionId/end
Response: { success: true, result: { duration: 125000 } }
```

### Get Quota Status
```bash
GET /api/quota
Response: {
  groq: { used: 15, limit: 30, percentUsed: 50 },
  google_tts: { used: 325000, limit: 1000000, percentUsed: 32.5 }
}
```

## 🔄 Conversation Flow

```
1. Client initiates call
   ↓ LLM generates greeting (Groq call 1)
   ↓ TTS converts to speech (Google call 1)

2. User responds (audio)
   ↓ Groq Whisper converts to text
   ↓ Detect intent & update state

3. LLM generates response (Groq call 2)
   ↓ TTS converts to speech (Google call 2)

4. Steps 2-3 repeat until end

5. Call ends
   ↓ Save transcript to SQLite
   ↓ Calculate metrics
```

## 📈 Scaling Beyond Free Tier

When you outgrow free tier:

| Usage | Monthly Cost |
|-------|--------------|
| 100 calls | $0 (free) |
| 1,000 calls | ~$1.50 |
| 10,000 calls | ~$15 |
| 100,000 calls | ~$150 |

**Upgrade path:**
- Groq: ~$0.0005 per API call (pay-as-you-go)
- Google TTS: ~$15 per 1M characters
- Server: $5-10/month for production

## 🛡️ Security

- ✅ API keys in environment variables
- ✅ Session isolation with UUIDs
- ✅ CORS configured
- ✅ Input validation
- ✅ Local SQLite (no cloud exposure)
- ✅ Rate limiting

## 📝 Files Overview

```
backend/
├── managers/
│   ├── LLMResponseEngine.js        # Groq LLM (FREE)
│   ├── SpeechToTextManager.js      # Groq Whisper (FREE)
│   ├── TextToSpeechManager.js      # Google Cloud TTS (FREE)
│   ├── DialogueStateEngine.js      # Conversation states
│   ├── ConversationMemoryManager.js # Memory & context
│   └── DatabaseManager.js          # SQLite (local)
├── routes/
│   └── callRoutes.js               # REST API endpoints
├── server.js                       # Express server
├── package.json                    # Dependencies
└── .env.example                    # Configuration
```

## ✅ Checklist for Production

- [ ] Get Groq API key (30 seconds)
- [ ] Get Google Cloud TTS key (3-5 minutes)
- [ ] Setup `.env` file
- [ ] Run locally: `npm run dev`
- [ ] Deploy to Railway (2 minutes)
- [ ] Test `/api/health` endpoint
- [ ] Monitor quota usage first 24 hours
- [ ] Create frontend client (React)
- [ ] Connect phone system (optional)

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Test with free tier limits
3. Submit pull request

## 📄 License

ISC License - See LICENSE file

## 🙏 Acknowledgments

- **Groq** - Fast LLM inference & Whisper STT (free tier)
- **Google Cloud** - Text-to-Speech neural voices (free tier)
- **Node.js** - JavaScript runtime
- **SQLite** - Lightweight database
- Open source community

---

## 🎯 Summary

| Component | API | Cost | Limit |
|-----------|-----|------|-------|
| **LLM** | Groq | $0 | 30 req/min |
| **STT** | Groq Whisper | $0 | Included |
| **TTS** | Google Cloud | $0 | 1M chars/mo |
| **Database** | SQLite | $0 | Local |
| **Server** | Railway/Render | $0 | Free tier |
| **TOTAL** | **Everything** | **$0** | ✅ |

**Start building your AI customer support agent today - completely free!** 🚀
