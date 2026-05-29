# AI Phone Call Agent

A production-ready AI customer care agent that makes and receives **real phone calls** using **Twilio Voice** and **Groq** (free — llama-3.3-70b). Groq runs Llama 3.3 on custom hardware making it extremely fast — ideal for live phone calls.

```
Caller → Twilio → /incoming-call → Gather speech
       ← TwiML speaks AI reply ← Groq API (free) ← /handle-speech
```

---

## Quick start (5 minutes)

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure credentials

```bash
cp .env.example .env
# Edit .env with your keys (see below for where to get them)
```

**Keys you need:**

| Key | Where to get it |
|-----|----------------|
| `TWILIO_ACCOUNT_SID` | [console.twilio.com](https://console.twilio.com) → Account info |
| `TWILIO_AUTH_TOKEN` | Same page |
| `TWILIO_PHONE_NUMBER` | Twilio Console → Phone Numbers → Buy a number (~$1/mo) |
| `GROQ_API_KEY` | [console.groq.com](https://console.groq.com) → API Keys — **free, no credit card** |

### 3. Start the server

```bash
# With automatic ngrok tunnel (recommended for development)
python start.py --ngrok

# Or start manually
python start.py
```

### 4. Point Twilio at your server

1. Open [Twilio Console → Phone Numbers](https://console.twilio.com/us1/develop/phone-numbers/manage/incoming)
2. Click your number → **Voice Configuration**
3. Set **"A call comes in"** → Webhook → `https://YOUR-URL.ngrok.io/incoming-call`
4. Save

### 5. Make your first call

**Inbound:** Call your Twilio number from any phone — Aria will answer!

**Outbound (trigger via API):**
```bash
curl -X POST http://localhost:5050/make-call \
  -H "Content-Type: application/json" \
  -d '{"to_phone_number": "+91XXXXXXXXXX", "context": "Order #45823 shipping update"}'
```

---

## Project structure

```
ai_call_agent/
├── main.py           # FastAPI app — all webhook endpoints
├── config.py         # Settings loaded from .env
├── conversation.py   # Per-call message history store
├── start.py          # Server + optional ngrok launcher
├── requirements.txt
└── .env.example      # Template — copy to .env
```

---

## API reference

### `POST /incoming-call`
Twilio webhook — called when someone dials your number.
Returns TwiML that greets the caller and starts listening.

### `POST /handle-speech`
Twilio posts the transcribed speech here.
Calls Claude, returns TwiML with the spoken reply.

### `POST /make-call`
Trigger an outbound call from your server.

**Request body:**
```json
{
  "to_phone_number": "+91XXXXXXXXXX",
  "context": "Optional context — e.g. Order #45823 delayed"
}
```

**Response:**
```json
{
  "status": "initiated",
  "call_sid": "CAxxxxxxxxxxxxxxxxxxxx",
  "to": "+91XXXXXXXXXX"
}
```

### `POST /call-status`
Twilio lifecycle webhook (completed, failed, busy, no-answer).
Logs the call summary and cleans up memory.

### `GET /`
Health check — returns agent name and Twilio number.

---

## Customising the agent

Edit these values in `.env` or `config.py`:

```
AGENT_NAME=Priya
BUSINESS_NAME=Flipkart Customer Care
TTS_VOICE=Polly.Raveena
SPEECH_LANGUAGE=en-IN
ESCALATION_NUMBER=+91XXXXXXXXXX   # human agent number

# Swap model anytime — all free on Groq
GROQ_MODEL=llama-3.1-8b-instant   # faster but lighter
```

**Groq free tier limits** (as of 2025):
| Model | Requests/day | Tokens/min |
|-------|-------------|------------|
| `llama-3.3-70b-versatile` | 14,400 | 6,000 |
| `llama-3.1-8b-instant` | 14,400 | 131,072 |
| `gemma2-9b-it` | 14,400 | 15,000 |

---

