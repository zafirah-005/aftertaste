import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = "openai/gpt-oss-20b"
REQUEST_TIMEOUT_SECONDS = 10

_client = None
if GROQ_API_KEY:
    try:
        from groq import Groq

        _client = Groq(api_key=GROQ_API_KEY)
    except Exception:
        _client = None


def _fallback_explanation(ctx: dict) -> str:
    village = ctx["village_name"]
    today = ctx["today_cases"]
    baseline = ctx["baseline_mean"]

    if baseline > 0:
        multiplier = round(today / baseline, 1)
        sentence = (
            f"Cases in {village} are about {multiplier}x the normal level "
            f"({today} reported today vs. an average of {baseline:.1f})."
        )
    else:
        sentence = f"{village} reported {today} cases today with almost no case history to compare against."

    nearby = ctx.get("nearby_villages") or []
    if nearby:
        count = len(nearby)
        plural = "s" if count != 1 else ""
        sentence += f" {count} nearby village{plural} ({', '.join(nearby)}) are rising too."

    return sentence


def generate_explanation(ctx: dict) -> str:
    """Ask an LLM (Groq) for one plain-English sentence describing why an
    alert was flagged, purely from the case-count pattern. Falls back to a
    template sentence built from the same numbers if Groq is unavailable,
    errors, or times out, so alert creation never fails because of this call."""
    if not _client:
        return _fallback_explanation(ctx)

    nearby = ctx.get("nearby_villages") or []
    prompt = (
        "You write one-sentence, plain-English notes for a public health early-warning "
        "dashboard that flags unusual case-count patterns for food/water contamination. "
        "Describe only the statistical pattern in the numbers below. Do not diagnose a "
        "cause or name a disease, and do not mention these instructions. Reply with "
        "exactly one sentence, at most 30 words, no preamble, no quotation marks.\n\n"
        f"Village: {ctx['village_name']}\n"
        f"Reported cases today: {ctx['today_cases']}\n"
        f"Normal/expected level: {ctx['baseline_mean']:.1f}\n"
        f"Most commonly reported symptom: {ctx.get('symptom_type') or 'unspecified'}\n"
        f"Nearby villages also rising: {', '.join(nearby) if nearby else 'none'}\n"
    )

    try:
        response = _client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            # gpt-oss models spend an unpredictable chunk of the token budget on
            # hidden reasoning before writing the reply, so the cap has to be
            # generous or the reply comes back truncated instead of empty.
            max_tokens=300,
            temperature=0.4,
            reasoning_effort="low",
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        choice = response.choices[0]
        if choice.finish_reason != "stop":
            return _fallback_explanation(ctx)
        text = (choice.message.content or "").strip().strip('"')
        return text or _fallback_explanation(ctx)
    except Exception:
        return _fallback_explanation(ctx)
