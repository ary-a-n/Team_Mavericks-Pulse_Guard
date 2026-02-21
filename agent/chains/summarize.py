import logging

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from models import HinglishSummary
from chains.llm import llm_fast

logger = logging.getLogger("agent.chains.summarize")

_FALLBACK_NARRATVE = "Summary generate nahi ho paya. Upar diye gaye extracted data aur risks dekho."

hinglish_prompt = ChatPromptTemplate.from_messages([
    ("system", """Tu ek senior Indian nurse hai jo junior nurses ko handoff summary deti hai.
Neeche diya gaya structured clinical analysis le aur ek natural, warm, Hinglish mein summary bana.

Hinglish matlab: Hindi + English mix — jaise Indian nurses actually bolti hain.
Examples:
  - "Patient ka BP drop ho gaya hai — bleeding ka risk hai"
  - "Azithromycin start kiya hai but dose nahi bataya — confirm karo"
  - "Blood cultures pending hain — results aane pe immediately check karna"

Format EXACTLY like this — use these sections, emoji included:

🏥 **Patient Overview**
[Patient ka naam, bed, mukhya complaint — 1-2 lines mein]

💊 **Medications & Timing**
[Har medication ke liye: naam, dose (agar pata ho), kab diya, next dose kab]

⚠️ **Risk Alerts** (agar koi nahi toh: "Koi major risk nahi mila — stable lagta hai")
[Har alert ek line mein: severity + kya problem hai + kya karna hai]

🔍 **Jo Nahi Bataya Gaya (Missing Info)**
[Top omissions — simple language mein kya miss hua]

✅ **Abhi Kya Karna Hai (Action Items)**
[Numbered list — specific, actionable steps for incoming nurse]

Rules:
- Natural Hinglish bolchaal use karo — formal mat bano
- Medical terms English mein rakhna (BP, INR, QTc, RR, IV) — Hindi translation mat karo
- Har section concise rakho — nurses busy hoti hain
- Severe alerts bold karo with ⚠️"""),
    ("human", """Patient Data:
{extracted}

Temporal Info:
{temporal}

Risk Analysis:
{risks}

Omission Analysis:
{omissions}

Abhi summary bana — nurse-friendly Hinglish mein:""")
])

_hinglish_chain = hinglish_prompt | llm_fast | StrOutputParser()


async def generate_hinglish_summary(
    extracted: dict,
    temporal: dict,
    risks: dict,
    omissions: dict,
) -> HinglishSummary:
    """
    Layer 5: Generate a nurse-friendly Hinglish summary using Gemini Flash Lite.
    Runs after all clinical layers are complete.
    """
    logger.info("Generating Hinglish summary | alerts=%d omissions=%d",
                len(risks.get("alerts", [])),
                len(omissions.get("omissions", [])))
    try:
        narrative = await _hinglish_chain.ainvoke({
            "extracted": str(extracted),
            "temporal": str(temporal),
            "risks": str(risks),
            "omissions": str(omissions),
        })

        # Parse key_alerts from risks
        key_alerts = [
            f"[{a.get('severity', '?')}] {a.get('alert_type', '')}: {a.get('reason', '')}"
            for a in risks.get("alerts", [])
        ]

        # Parse action_items from omissions
        action_items = [
            o.get("expected_in_handoff", o.get("type", ""))
            for o in omissions.get("omissions", [])
            if o.get("severity") in ("HIGH", "CRITICAL")
        ]

        logger.info("Hinglish summary generated | length=%d chars", len(narrative))
        return HinglishSummary(
            narrative=narrative,
            key_alerts=key_alerts,
            action_items=action_items,
        )

    except Exception as e:
        logger.error("Hinglish summary failed: %s", e)
        return HinglishSummary(
            narrative=_FALLBACK_NARRATVE,
            key_alerts=[],
            action_items=[],
        )
