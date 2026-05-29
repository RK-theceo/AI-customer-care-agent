"""
AI Phone Call Agent — FastAPI Server
Twilio Voice + Groq API (llama-3.3-70b-versatile) — FREE tier

Flow:
  Inbound call  → POST /incoming-call  → returns TwiML (gather speech)
  Speech result → POST /handle-speech  → Groq generates reply → TwiML speaks it
  Outbound call → POST /make-call      → Twilio dials number, points to /incoming-call
"""

import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Form
from fastapi.responses import PlainTextResponse
from openai import AsyncOpenAI
from openai import APIError as GroqAPIError
from twilio.rest import Client as TwilioClient
from twilio.twiml.voice_response import VoiceResponse, Gather
from dotenv import load_dotenv

from conversation import ConversationStore
from config import settings

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# App lifecycle
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("AI Call Agent starting up …")
    log.info(f"  Twilio number : {settings.twilio_phone_number}")
    log.info(f"  Base URL      : {settings.base_url}")
    log.info(f"  Agent name    : {settings.agent_name}")
    yield
    log.info("Shutting down.")


app = FastAPI(
    title="AI Phone Call Agent",
    description="Twilio Voice + Groq (free) — customer care automation",
    version="2.0.0",
    lifespan=lifespan,
)

# In-memory conversation store (replace with Redis for production)
store = ConversationStore()

# Clients
twilio_client = TwilioClient(settings.twilio_account_sid, settings.twilio_auth_token)
groq_client = AsyncOpenAI(
    api_key=settings.groq_api_key,
    base_url="https://api.groq.com/openai/v1",
)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/")
async def health():
    return {
        "status": "running",
        "agent": settings.agent_name,
        "twilio_number": settings.twilio_phone_number,
    }


# ---------------------------------------------------------------------------
# Inbound call — called by Twilio when someone calls your number
# ---------------------------------------------------------------------------

@app.post("/incoming-call", response_class=PlainTextResponse)
async def incoming_call(
    request: Request,
    CallSid: str = Form(...),
    From: str = Form(...),
    To: str = Form(...),
):
    log.info(f"Inbound call  SID={CallSid}  from={From}  to={To}")

    # Initialise a fresh conversation for this call
    store.create(CallSid, caller=From)

    # Build TwiML: greet the caller, then start listening
    response = VoiceResponse()
    gather = Gather(
        input="speech",
        action=f"{settings.base_url}/handle-speech",
        method="POST",
        speechTimeout="auto",
        language=settings.speech_language,
        enhanced=True,
    )
    gather.say(
        _greeting(settings.agent_name, settings.business_name),
        voice=settings.tts_voice,
        language=settings.speech_language,
    )
    response.append(gather)

    # Fallback if caller says nothing
    response.redirect(f"{settings.base_url}/no-input", method="POST")
    return PlainTextResponse(str(response), media_type="application/xml")


# ---------------------------------------------------------------------------
# Handle speech — Twilio posts the transcribed text here
# ---------------------------------------------------------------------------

@app.post("/handle-speech", response_class=PlainTextResponse)
async def handle_speech(
    request: Request,
    CallSid: str = Form(...),
    SpeechResult: str = Form(default=""),
    Confidence: str = Form(default="0"),
):
    log.info(f"Speech  SID={CallSid}  conf={Confidence}  text={SpeechResult!r}")

    response = VoiceResponse()

    if not SpeechResult:
        gather = Gather(
            input="speech",
            action=f"{settings.base_url}/handle-speech",
            method="POST",
            speechTimeout="auto",
            language=settings.speech_language,
            enhanced=True,
        )
        gather.say(
            "I'm sorry, I didn't catch that. Could you please repeat?",
            voice=settings.tts_voice,
            language=settings.speech_language,
        )
        response.append(gather)
        return PlainTextResponse(str(response), media_type="application/xml")

    # Retrieve conversation history
    history = store.get_history(CallSid)
    if history is None:
        # Call was started without hitting /incoming-call (e.g. direct test)
        store.create(CallSid, caller="unknown")
        history = store.get_history(CallSid)

    # Add user turn
    store.add_message(CallSid, "user", SpeechResult)

    # Get AI response from Groq
    ai_reply, should_escalate = await _get_groq_response(
        store.get_history(CallSid)
    )
    log.info(f"Groq reply: {ai_reply!r}  escalate={should_escalate}")

    # Add assistant turn to history
    store.add_message(CallSid, "assistant", ai_reply)

    if should_escalate:
        # Hand off to human agent
        response.say(
            ai_reply,
            voice=settings.tts_voice,
            language=settings.speech_language,
        )
        _do_escalation(response)
    else:
        # Speak the reply and keep listening
        gather = Gather(
            input="speech",
            action=f"{settings.base_url}/handle-speech",
            method="POST",
            speechTimeout="auto",
            language=settings.speech_language,
            enhanced=True,
        )
        gather.say(
            ai_reply,
            voice=settings.tts_voice,
            language=settings.speech_language,
        )
        response.append(gather)
        response.redirect(f"{settings.base_url}/no-input", method="POST")

    return PlainTextResponse(str(response), media_type="application/xml")


# ---------------------------------------------------------------------------
# No-input fallback
# ---------------------------------------------------------------------------

@app.post("/no-input", response_class=PlainTextResponse)
async def no_input(CallSid: str = Form(...)):
    log.info(f"No input  SID={CallSid}")
    response = VoiceResponse()
    gather = Gather(
        input="speech",
        action=f"{settings.base_url}/handle-speech",
        method="POST",
        speechTimeout="auto",
        language=settings.speech_language,
        enhanced=True,
    )
    gather.say(
        "Are you still there? I'm here to help you.",
        voice=settings.tts_voice,
        language=settings.speech_language,
    )
    response.append(gather)
    response.say(
        "I haven't heard from you. Goodbye, and have a great day!",
        voice=settings.tts_voice,
        language=settings.speech_language,
    )
    response.hangup()
    return PlainTextResponse(str(response), media_type="application/xml")


# ---------------------------------------------------------------------------
# Outbound call — trigger an AI-initiated call via REST
# ---------------------------------------------------------------------------

@app.post("/make-call")
async def make_call(request: Request):
    """
    POST body (JSON):
    {
        "to_phone_number": "+91XXXXXXXXXX",
        "context": "Optional context for the agent, e.g. order #123 delayed"
    }
    """
    body = await request.json()
    to_number = body.get("to_phone_number")
    context = body.get("context", "")

    if not to_number:
        return {"error": "to_phone_number is required"}

    # Store pre-call context so the agent mentions it naturally
    if context:
        # We use a temporary key; Twilio will give us the real CallSid on connect
        store.set_outbound_context(to_number, context)

    call = twilio_client.calls.create(
        to=to_number,
        from_=settings.twilio_phone_number,
        url=f"{settings.base_url}/outbound-start?context={context}",
        method="POST",
        status_callback=f"{settings.base_url}/call-status",
        status_callback_method="POST",
    )

    log.info(f"Outbound call initiated  SID={call.sid}  to={to_number}")
    return {"status": "initiated", "call_sid": call.sid, "to": to_number}


# ---------------------------------------------------------------------------
# Outbound call start — same as inbound but with optional context injection
# ---------------------------------------------------------------------------

@app.post("/outbound-start", response_class=PlainTextResponse)
async def outbound_start(
    request: Request,
    CallSid: str = Form(...),
    To: str = Form(...),
    context: str = "",
):
    log.info(f"Outbound connected  SID={CallSid}  to={To}")

    store.create(CallSid, caller=To, outbound_context=context)

    response = VoiceResponse()
    greeting = _greeting(settings.agent_name, settings.business_name, context=context)
    gather = Gather(
        input="speech",
        action=f"{settings.base_url}/handle-speech",
        method="POST",
        speechTimeout="auto",
        language=settings.speech_language,
        enhanced=True,
    )
    gather.say(greeting, voice=settings.tts_voice, language=settings.speech_language)
    response.append(gather)
    response.redirect(f"{settings.base_url}/no-input", method="POST")
    return PlainTextResponse(str(response), media_type="application/xml")


# ---------------------------------------------------------------------------
# Call status webhook — Twilio posts lifecycle events here
# ---------------------------------------------------------------------------

@app.post("/call-status")
async def call_status(
    CallSid: str = Form(...),
    CallStatus: str = Form(...),
    CallDuration: str = Form(default="0"),
):
    log.info(f"Call status  SID={CallSid}  status={CallStatus}  duration={CallDuration}s")

    if CallStatus in ("completed", "failed", "busy", "no-answer"):
        summary = store.summarise(CallSid)
        log.info(f"Call ended  SID={CallSid}\n{summary}")
        store.cleanup(CallSid)

    return {"received": True}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _greeting(agent_name: str, business_name: str, context: str = "") -> str:
    if context:
        return (
            f"Hello! This is {agent_name} calling from {business_name}. "
            f"I'm reaching out regarding {context}. "
            "How are you doing today?"
        )
    return (
        f"Hello! Thank you for calling {business_name}. "
        f"My name is {agent_name} and I'm here to help you. "
        "How can I assist you today?"
    )


async def _get_groq_response(history: list[dict]) -> tuple[str, bool]:
    """
    Call Groq (llama-3.3-70b-versatile) with the conversation history.
    Returns (reply_text, should_escalate).
    Groq is free tier — ~14,400 requests/day on llama-3.3-70b.
    """
    try:
        # Groq uses the OpenAI chat format — system prompt is a separate message
        messages = [{"role": "system", "content": settings.system_prompt}] + history

        response = await groq_client.chat.completions.create(
            model=settings.groq_model,
            messages=messages,
            max_tokens=300,
            temperature=0.7,
        )
        reply = response.choices[0].message.content.strip()

        # Simple escalation detection
        escalation_phrases = [
            "transfer you to", "connect you with a", "human agent",
            "live representative", "escalating", "transferring your call",
        ]
        should_escalate = any(p in reply.lower() for p in escalation_phrases)

        return reply, should_escalate

    except GroqAPIError as e:
        log.error(f"Groq API error: {e}")
        return (
            "I'm sorry, I'm experiencing a technical issue right now. "
            "Please hold while I connect you with a team member.",
            True,
        )


def _do_escalation(response: VoiceResponse):
    """Add escalation TwiML — dial your human agent queue or number."""
    if settings.escalation_number:
        response.say(
            "Please hold while I connect you.",
            voice=settings.tts_voice,
            language=settings.speech_language,
        )
        response.dial(settings.escalation_number)
    else:
        response.say(
            "I'll arrange for a team member to call you back shortly. "
            "Thank you for your patience. Goodbye!",
            voice=settings.tts_voice,
            language=settings.speech_language,
        )
        response.hangup()
