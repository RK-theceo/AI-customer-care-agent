"""
config.py — all settings loaded from environment variables / .env file
"""

from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    # ── Twilio ──────────────────────────────────────────────────────────────
    twilio_account_sid: str = Field(..., env="TWILIO_ACCOUNT_SID")
    twilio_auth_token: str = Field(..., env="TWILIO_AUTH_TOKEN")
    twilio_phone_number: str = Field(..., env="TWILIO_PHONE_NUMBER")

    # ── Groq (free) ─────────────────────────────────────────────────────────
    # Get your free key at console.groq.com — no credit card needed
    groq_api_key: str = Field(..., env="GROQ_API_KEY")

    # Available free models on Groq:
    #   "llama-3.3-70b-versatile"  — best quality,  ~14,400 req/day free
    #   "llama-3.1-8b-instant"     — fastest,        ~14,400 req/day free
    #   "gemma2-9b-it"             — Google Gemma 2,  ~14,400 req/day free
    #   "mixtral-8x7b-32768"       — long context,    ~14,400 req/day free
    groq_model: str = Field("llama-3.3-70b-versatile", env="GROQ_MODEL")

    # ── Server ──────────────────────────────────────────────────────────────
    # Public HTTPS URL Twilio can reach — use ngrok in dev, your domain in prod
    base_url: str = Field("https://your-ngrok-url.ngrok.io", env="BASE_URL")
    port: int = Field(5050, env="PORT")

    # ── Agent persona ────────────────────────────────────────────────────────
    agent_name: str = Field("Aria", env="AGENT_NAME")
    business_name: str = Field("TechStore India", env="BUSINESS_NAME")

    # ── Voice / speech ───────────────────────────────────────────────────────
    # Twilio voice options:
    #   "Polly.Aditi"    — Indian English (Amazon)
    #   "Polly.Raveena"  — Indian English (Amazon)
    #   "Google.en-IN-Standard-A" — Google WaveNet Indian English
    #   "alice"          — Twilio built-in
    tts_voice: str = Field("Polly.Aditi", env="TTS_VOICE")
    speech_language: str = Field("en-IN", env="SPEECH_LANGUAGE")

    # ── Escalation ───────────────────────────────────────────────────────────
    # Phone number to dial when Claude decides to escalate (optional)
    escalation_number: str = Field("", env="ESCALATION_NUMBER")

    # ── System prompt ────────────────────────────────────────────────────────
    system_prompt: str = Field(
        default="""You are Aria, a professional and empathetic customer care agent for TechStore India.

IMPORTANT — PHONE CALL RULES:
- You are speaking on a LIVE PHONE CALL. Keep every response under 3 sentences.
- Speak naturally, conversationally. No bullet points, no lists, no markdown.
- Do NOT say "I" at the start of every sentence — vary your phrasing.
- Always sound warm and human. Avoid robotic or overly formal language.

YOUR CAPABILITIES:
- Order status, shipping & delivery inquiries
- Returns, refunds, and exchange requests
- Product information and recommendations
- Account and billing queries
- General support and troubleshooting

ESCALATION RULES — say you will "transfer you to a live representative" if:
- The customer is very upset or using abusive language
- The issue requires database access you don't have
- Legal, fraud, or security concerns are raised
- You've attempted to help twice and failed

VERIFICATION:
- Always ask for order number OR registered email before sharing account details.
- Never share sensitive data (full card number, passwords) over the phone.

TONE: Warm, confident, solution-focused. Mirror the customer's energy — calm them if they're upset, match enthusiasm if they're excited.""",
        env="SYSTEM_PROMPT",
    )

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
