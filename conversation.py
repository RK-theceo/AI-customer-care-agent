"""
conversation.py — in-memory conversation store

Stores per-call message history for Claude.
For production, swap the dict for Redis with TTL.
"""

import logging
from datetime import datetime
from threading import Lock

log = logging.getLogger(__name__)

# Maximum messages to keep per call (older ones are trimmed to avoid huge prompts)
MAX_HISTORY = 20


class ConversationStore:
    def __init__(self):
        self._lock = Lock()
        # { call_sid: { "caller": str, "history": [...], "started_at": datetime, ... } }
        self._calls: dict[str, dict] = {}
        # Temporary outbound context keyed by phone number
        self._outbound_ctx: dict[str, str] = {}

    # ── Create ──────────────────────────────────────────────────────────────

    def create(self, call_sid: str, caller: str, outbound_context: str = "") -> None:
        with self._lock:
            if call_sid in self._calls:
                return  # already exists
            self._calls[call_sid] = {
                "caller": caller,
                "history": [],
                "started_at": datetime.utcnow(),
                "outbound_context": outbound_context,
                "turn_count": 0,
            }
            log.debug(f"Conversation created  SID={call_sid}  caller={caller}")

    # ── Read ────────────────────────────────────────────────────────────────

    def get_history(self, call_sid: str) -> list[dict] | None:
        with self._lock:
            call = self._calls.get(call_sid)
            if call is None:
                return None
            return list(call["history"])  # return a copy

    # ── Write ───────────────────────────────────────────────────────────────

    def add_message(self, call_sid: str, role: str, content: str) -> None:
        with self._lock:
            call = self._calls.get(call_sid)
            if call is None:
                log.warning(f"add_message: unknown SID {call_sid}")
                return
            call["history"].append({"role": role, "content": content})
            call["turn_count"] += 1

            # Trim to MAX_HISTORY (keep most recent turns)
            if len(call["history"]) > MAX_HISTORY:
                call["history"] = call["history"][-MAX_HISTORY:]

    # ── Outbound context ────────────────────────────────────────────────────

    def set_outbound_context(self, phone: str, context: str) -> None:
        with self._lock:
            self._outbound_ctx[phone] = context

    def get_outbound_context(self, phone: str) -> str:
        with self._lock:
            return self._outbound_ctx.pop(phone, "")

    # ── Summary / cleanup ───────────────────────────────────────────────────

    def summarise(self, call_sid: str) -> str:
        with self._lock:
            call = self._calls.get(call_sid)
            if not call:
                return "No data."
            duration = (datetime.utcnow() - call["started_at"]).seconds
            turns = call["turn_count"]
            lines = [
                f"Caller       : {call['caller']}",
                f"Duration     : {duration}s",
                f"Turns        : {turns}",
                f"Messages     : {len(call['history'])}",
            ]
            if call["history"]:
                last = call["history"][-1]
                preview = last["content"][:120].replace("\n", " ")
                lines.append(f"Last message : [{last['role']}] {preview}")
            return "\n".join(lines)

    def cleanup(self, call_sid: str) -> None:
        with self._lock:
            self._calls.pop(call_sid, None)
            log.debug(f"Conversation cleaned up  SID={call_sid}")

    # ── Debug ────────────────────────────────────────────────────────────────

    def active_calls(self) -> list[str]:
        with self._lock:
            return list(self._calls.keys())
