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

## Production deployment

### Railway (recommended — free tier available)

```bash
# Install Railway CLI
npm install -g @railway/cli

railway login
railway init
railway up
```

Set environment variables in Railway dashboard, then update `BASE_URL` to your Railway domain.

### Render

1. Push code to GitHub
2. New Web Service → connect repo
3. Build command: `pip install -r requirements.txt`
4. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Add environment variables

### Docker

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5050"]
```

```bash
docker build -t ai-call-agent .
docker run -p 5050:5050 --env-file .env ai-call-agent
```

---

## Adding Redis for production history store

Replace `ConversationStore` in `main.py`:

```python
import redis, json

r = redis.from_url(os.getenv("REDIS_URL"))

def get_history(call_sid):
    data = r.get(f"call:{call_sid}")
    return json.loads(data) if data else []

def add_message(call_sid, role, content):
    history = get_history(call_sid)
    history.append({"role": role, "content": content})
    r.setex(f"call:{call_sid}", 3600, json.dumps(history))
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Twilio says "Application error" | Check that `BASE_URL` in `.env` is your ngrok HTTPS URL |
| No speech detected | Ensure `enhanced=True` and correct `SPEECH_LANGUAGE` |
| Claude times out | Reduce `MAX_HISTORY` in `conversation.py` or lower `max_tokens` |
| Call connects but no audio | Verify `TTS_VOICE` is a supported Twilio voice name |
| ngrok URL changes on restart | Use `ngrok` paid plan for a static domain, or deploy to Railway |
