import logging
from langchain_core.prompts import ChatPromptTemplate
from models import OmissionAnalysis, RiskSeverity
from chains.llm import llm, invoke_structured
from chains.knowledge_base import query_clinical_knowledge

logger = logging.getLogger("agent.chains.omissions")

omission_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are a "What Was NOT Said" analyzer for nurse handoffs.
Detect CRITICAL MISSING INFORMATION by analyzing what SHOULD have been mentioned but wasn't.

RETRIEVED MONITORING STANDARDS:
{rag_context}

NEGATIVE REASONING — detect ABSENCE of expected care elements:
- For any drug: was monitoring/level/assessment mentioned?
- For any condition: were relevant vitals and assessment mentioned?
- For any symptom: was follow-up or reassessment mentioned?
- For any risk identified: were appropriate precautions documented?

Return ONLY valid JSON matching this EXACT schema:

{{
  "omissions": [
    {{
      "type": "short_category e.g. glucose_monitoring",
      "severity": "HIGH or MEDIUM or LOW",
      "reason": "Why this omission is clinically dangerous",
      "expected_in_handoff": "What specifically should have been said"
    }}
  ],
  "high_risk_conditions_mentioned": ["condition name"],
  "missing_critical_items": ["item description"]
}}

Rules:
- Use EXACTLY these field names
- omissions not missing, expected_in_handoff not expected
- If nothing critical is missing: return {{"omissions": [], "high_risk_conditions_mentioned": [], "missing_critical_items": []}}
- Output ONLY the JSON object, no explanation"""),
    ("human", """Transcript: {transcript}
Extracted Entities: {extracted}
Detected Risks: {risks}
Previous Shift Context: {context}

Return ONLY the JSON:""")
])

omission_chain = omission_prompt | llm  # raw output — parsed by invoke_structured


def _build_omission_query(extracted: dict) -> str:
    """Build ChromaDB query focused on conditions and medications for protocol lookup."""
    meds = [m.get("name", "") for m in extracted.get("medications", [])]
    chief = extracted.get("summary", {}).get("chief_complaint", "")
    symptoms = [s.get("description", "") for s in extracted.get("symptoms", [])]
    return " ".join(filter(None, meds + [chief] + symptoms)) + " monitoring protocol handoff requirements"


async def analyze_omissions(
    transcript: str,
    extracted: dict,
    risks: dict,
    context: str = "",
) -> OmissionAnalysis:
    """Layer 4: Detect what critical information was NOT mentioned in handoff."""
    query = _build_omission_query(extracted)
    rag_context = query_clinical_knowledge(query, n_results=3)
    logger.info(
        "Omission analysis | active_risks=%d | kb_docs_retrieved=%s",
        len(risks.get("alerts", [])),
        "yes" if rag_context else "no",
    )

    try:
        result = await invoke_structured(omission_chain, {
            "transcript": transcript,
            "extracted": str(extracted),
            "risks": str(risks),
            "context": context,
            "rag_context": rag_context or "No specific protocols retrieved. Use general nursing handoff standards.",
        }, OmissionAnalysis)

        high_count = sum(1 for o in result.omissions if o.severity == RiskSeverity.HIGH)
        logger.info(
            "Omission analysis complete | total=%d high_severity=%d",
            len(result.omissions),
            high_count,
        )
        return result

    except Exception as e:
        logger.error("Omission analysis failed, returning empty result: %s", e)
        return OmissionAnalysis(
            omissions=[],
            high_risk_conditions_mentioned=[],
            missing_critical_items=[],
        )
