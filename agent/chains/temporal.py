import logging
import re
from datetime import datetime, timedelta

from langchain_core.prompts import ChatPromptTemplate
from models import TemporalData, TemporalEvent
from chains.llm import llm, invoke_structured

logger = logging.getLogger("agent.chains.temporal")

temporal_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are a temporal reasoning engine for healthcare handoffs.
Convert all relative time references to absolute timestamps.

Handoff happening at: {handoff_time}

Time conversion rules:
- "4 hours ago" → subtract 4 hours from handoff_time
- "subah" / "morning" → 08:00
- "raat" / "night" → 22:00
- "sham" / "evening" → 20:00
- "dopahar" / "afternoon" → 14:00
- "4 baje" → 04:00

Next dose calculation (standard frequencies):
- Warfarin → once daily (24h after last dose)
- Insulin (regular/short-acting) → every 4-6h
- Insulin (long-acting e.g. glargine) → every 24h
- IV antibiotics (Vancomycin, Pip-Tazo) → every 6-8h
- Oral antibiotics → every 8-12h
- Furosemide (Lasix) → every 12-24h
- Digoxin → every 24h
- Antihypertensives → every 12-24h

Return ONLY valid JSON matching this EXACT schema:

{{
  "handoff_time": "HH:MM (24-hour)",
  "events": [
    {{
      "event": "description of what happened",
      "absolute_time": "HH:MM",
      "relative_original": "exact phrase from transcript"
    }}
  ],
  "next_dose_times": ["HH:MM - medication name e.g. 08:00 - Warfarin (next daily dose)"],
  "calculated_times": {{}}
}}

Rules:
- Use EXACTLY these field names — event not type, absolute_time not time
- Always populate next_dose_times if any medication was given
- Output ONLY the JSON object, no explanation"""),
    ("human", """Transcript: {transcript}
Extracted Entities: {entities}
Handoff Time: {handoff_time}

Return ONLY the JSON:""")
])

temporal_chain = temporal_prompt | llm  # raw output — parsed by invoke_structured


async def resolve_temporal(transcript: str, entities: dict, handoff_time: str = "07:00") -> TemporalData:
    """
    Layer 2: Convert relative times to absolute timestamps.
    Handles Hindi time phrases (subah, raat, dopahar).
    """
    handoff_time = handoff_time.replace(" AM", "").replace(" PM", "").replace(" ", "")
    if len(handoff_time) == 4 and ":" not in handoff_time:
        handoff_time = f"{handoff_time[:2]}:{handoff_time[2:]}"

    logger.info("Resolving temporal references | handoff_time=%s", handoff_time)
    try:
        result = await invoke_structured(temporal_chain, {
            "transcript": transcript,
            "entities": str(entities),
            "handoff_time": handoff_time
        }, TemporalData)
        logger.info("Temporal resolution complete | events=%d next_doses=%d", len(result.events), len(result.next_dose_times))
        return result
    except Exception as e:
        logger.error("Temporal LLM failed, using regex fallback: %s", e)
        return _fallback_temporal_parsing(transcript, handoff_time)


# Maps Hindi/Urdu time-period words to a fixed absolute HH:MM for fallback use
_HINDI_TIME_MAP: dict[str, str] = {
    "subah": "08:00",
    "savere": "07:00",
    "dopahar": "14:00",
    "sham": "18:00",
    "shaam": "18:00",
    "raat": "22:00",
    "midnight": "00:00",
    "morning": "08:00",
    "afternoon": "14:00",
    "evening": "18:00",
    "night": "22:00",
}


def _fallback_temporal_parsing(transcript: str, handoff_time: str) -> TemporalData:
    """Regex + keyword fallback for temporal parsing when LLM is unavailable."""
    logger.warning("Using regex fallback for temporal parsing")
    events: list[TemporalEvent] = []

    numeric_patterns = [
        (r'(\d+)\s*baje', lambda m: f"{int(m.group(1)):02d}:00"),
        (r'(\d+)\s*(am|pm)', lambda m: f"{m.group(1)}:00 {m.group(2).upper()}"),
        (r'(\d+)\s*o\'?clock', lambda m: f"{int(m.group(1)):02d}:00"),
        (r'(\d+)\s*hours?\s*ago', lambda m: _hours_ago(handoff_time, int(m.group(1)))),
    ]

    for pattern, formatter in numeric_patterns:
        for match in re.finditer(pattern, transcript, re.IGNORECASE):
            events.append(TemporalEvent(
                event=f"Time reference: {match.group()}",
                absolute_time=formatter(match),
                relative_original=match.group()
            ))

    for word, absolute_time in _HINDI_TIME_MAP.items():
        if re.search(rf'\b{word}\b', transcript, re.IGNORECASE):
            events.append(TemporalEvent(
                event=f"Time period: {word}",
                absolute_time=absolute_time,
                relative_original=word,
            ))

    return TemporalData(
        handoff_time=handoff_time,
        events=events,
        next_dose_times=[],
        calculated_times={}
    )


def _hours_ago(handoff_time: str, hours: int) -> str:
    """Subtract hours from handoff_time string (HH:MM) and return HH:MM."""
    try:
        base = datetime.strptime(handoff_time, "%H:%M")
        result = base - timedelta(hours=hours)
        return result.strftime("%H:%M")
    except ValueError:
        return handoff_time
