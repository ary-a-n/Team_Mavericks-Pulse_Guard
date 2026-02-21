import json
import logging
import re
from typing import Any

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from models import HinglishSummary
from chains.llm import llm_fast

logger = logging.getLogger("agent.chains.summarize")

_FALLBACK = HinglishSummary(
    patient_overview="Summary generate nahi ho paya.",
    medications=[],
    risk_alerts=[],
    missing_info=[],
    action_items=[],
)

hinglish_prompt = ChatPromptTemplate.from_messages([
    ("system", """
Tu ek senior Indian nurse hai jo incoming nurse ko shift handoff deta/deti hai.
Neeche diya gaya structured clinical data le aur ek concise Hinglish handoff summary banao.

Hinglish guidelines:
- Hindi sentence structure + clinical terms English mein (BP, HR, RR, SpO2, IV, ECG, labs).
- Tone: calm, direct, professional.

Return a VALID JSON object with EXACTLY these keys. No markdown, no extra text — just the JSON.

{{
  "patient_overview": "<1-2 lines: patient name, bed, diagnosis, current status>",
  "medications": [
    "<Medication name, dose (agar pata ho), time given / next due. Unknown ho to 'Not stated'>"
  ],
  "risk_alerts": [
    "<[SEVERITY] Alert type: reason — immediate action required>"
  ],
  "missing_info": [
    "<Kya missing hai aur kyun critical hai — 1 line>"
  ],
  "action_items": [
    "<Specific nursing step — Confirm/Check/Monitor/Notify verb se shuru karo>"
  ]
}}

Rules:
- risk_alerts empty array agar koi risk nahi.
- medications empty array agar koi medication nahi.
- missing_info max 5 items; low-value items skip karo.
- action_items 3-7 items.
- No emojis anywhere in the output.
- Inferred info: "(Inferred)" mark karo.
    """.strip()),
    ("human", """
Patient Data:
{extracted}

Temporal Info:
{temporal}

Risk Analysis:
{risks}

Omission Analysis:
{omissions}

Now return the JSON object:
    """.strip())
])

_hinglish_chain = hinglish_prompt | llm_fast | StrOutputParser()


def _extract_json(raw: str) -> dict[str, Any]:
    """Strip markdown fences if the LLM wraps output in ```json ... ```."""
    cleaned = raw.strip()
    fence_match = re.search(r"```(?:json)?\s*(.*?)```", cleaned, re.DOTALL)
    if fence_match:
        cleaned = fence_match.group(1).strip()
    return json.loads(cleaned)


async def generate_hinglish_summary(
    extracted: dict,
    temporal: dict,
    risks: dict,
    omissions: dict,
) -> HinglishSummary:
    """
    Layer 5: Generate a structured Hinglish handoff summary.
    Returns one typed field per UI section — no markdown blob.
    """
    logger.info(
        "Generating structured Hinglish summary | alerts=%d omissions=%d",
        len(risks.get("alerts", [])),
        len(omissions.get("omissions", [])),
    )
    try:
        raw = await _hinglish_chain.ainvoke({
            "extracted": str(extracted),
            "temporal": str(temporal),
            "risks": str(risks),
            "omissions": str(omissions),
        })

        data = _extract_json(raw)

        summary = HinglishSummary(
            patient_overview=data.get("patient_overview", ""),
            medications=data.get("medications", []),
            risk_alerts=data.get("risk_alerts", []),
            missing_info=data.get("missing_info", []),
            action_items=data.get("action_items", []),
        )
        logger.info(
            "Structured summary built | medications=%d risk_alerts=%d action_items=%d",
            len(summary.medications),
            len(summary.risk_alerts),
            len(summary.action_items),
        )
        return summary

    except Exception as e:
        logger.error("Hinglish summary failed: %s | raw_start=%r", e, locals().get("raw", "")[:200])
        return _FALLBACK
