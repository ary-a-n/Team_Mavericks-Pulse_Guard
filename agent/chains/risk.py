import logging
from langchain_core.prompts import ChatPromptTemplate
from models import RiskAssessment, RiskSeverity
from chains.llm import llm, invoke_structured
from chains.knowledge_base import query_clinical_knowledge

logger = logging.getLogger("agent.chains.risk")

risk_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are a clinical safety checker for nursing handoffs.
Analyze patient data and identify DANGEROUS combinations that could harm the patient.

RETRIEVED CLINICAL KNOWLEDGE (primary reference):
{rag_context}

BASELINE SAFETY PATTERNS (use alongside retrieved knowledge):
Cardiac:
- Warfarin + sudden BP drop (>30mmHg) + headache = BLEEDING TRIAD → CRITICAL
- Warfarin + NO INR mentioned = cannot dose safely → HIGH
- Chest pain + no ECG + diaphoresis = ACUTE CORONARY SYNDROME risk → CRITICAL
- Digoxin + low potassium = DIGOXIN TOXICITY risk → HIGH
- Azithromycin/Clarithromycin/Fluoroquinolones + QTc not checked = ARRHYTHMIA RISK → HIGH
Respiratory:
- RR > 20 + COPD history = RESPIRATORY DETERIORATION risk → HIGH
- RR > 25 = respiratory distress regardless of cause → HIGH
- Pneumonia + Heart Failure = fluid overload masking / worsening → HIGH
- COPD + O2 not mentioned = hypoxia risk unmonitored → MEDIUM
- Fever not trending down on antibiotics = treatment failure risk → MEDIUM
Sepsis/Infection:
- Blood cultures pending + antibiotics = must review culture results → HIGH
- Fever (>38.5) + HR>100 + low BP = SEPSIS TRIAD → CRITICAL
- Broad-spectrum antibiotics (Ceftriaxone, Pip-Tazo) + no allergy check = reaction risk → MEDIUM
Metabolic:
- Insulin + no glucose check + sweating/confusion = HYPOGLYCEMIA TRIAD → CRITICAL
- Opioids + RR<12 = RESPIRATORY DEPRESSION → CRITICAL
- Any anticoagulant + fall risk + no fall precautions = HIGH

INSTRUCTION: Always generate alerts where these patterns match. Never return empty alerts for a patient
with active infection, RR abnormality, or known multi-system disease (COPD + HF + pneumonia).
Name the clinical syndrome/triad in the reason field when applicable.

Return ONLY valid JSON matching this EXACT schema:

{{
  "alerts": [
    {{
      "severity": "CRITICAL or HIGH or MEDIUM or LOW",
      "alert_type": "SHORT_IDENTIFIER e.g. BLEEDING_RISK",
      "reason": "Explain the dangerous combination clearly",
      "action_required": "What the nurse must do NOW",
      "confidence": 0.9
    }}
  ],
  "overall_risk": "CRITICAL or HIGH or MEDIUM or LOW",
  "risk_score": 0
}}

Rules:
- Use EXACTLY these field names — alerts not risks, alert_type not type
- overall_risk must be the highest severity across all alerts
- risk_score: CRITICAL=100, HIGH=75, MEDIUM=50, LOW=25, none=0
- If NO risks: return {{"alerts": [], "overall_risk": "LOW", "risk_score": 0}}
- Output ONLY the JSON object, no explanation"""),
    ("human", """Extracted Patient Data: {extracted}
Temporal Information: {temporal}
Handoff Time: {handoff_time}

Return ONLY the JSON:""")
])

risk_chain = risk_prompt | llm  # raw output — parsed by invoke_structured

_SCORE_MAP = {
    RiskSeverity.CRITICAL: 100,
    RiskSeverity.HIGH: 75,
    RiskSeverity.MEDIUM: 50,
    RiskSeverity.LOW: 25,
}


def _build_risk_query(extracted: dict) -> str:
    """Build ChromaDB query from medications, symptoms, and vitals."""
    meds = [m.get("name", "") for m in extracted.get("medications", [])]
    symptoms = [s.get("description", "") for s in extracted.get("symptoms", [])]
    vitals = [f"{v.get('type', '')} {v.get('value', '')}" for v in extracted.get("vitals", [])]
    chief = extracted.get("summary", {}).get("chief_complaint", "")
    return " ".join(filter(None, meds + symptoms + vitals + [chief]))


def _compute_overall_risk(result: RiskAssessment) -> None:
    """Mutate result to set overall_risk and risk_score from alerts."""
    if not result.alerts:
        result.overall_risk = RiskSeverity.LOW
        result.risk_score = 0
        return
    highest = max(result.alerts, key=lambda a: _SCORE_MAP.get(a.severity, 0))
    result.overall_risk = highest.severity
    result.risk_score = _SCORE_MAP.get(highest.severity, 0)


async def detect_risks(extracted: dict, temporal: dict, handoff_time: str = "07:00") -> RiskAssessment:
    """Layer 3: Detect dangerous clinical combinations using RAG + LLM."""
    query = _build_risk_query(extracted)
    rag_context = query_clinical_knowledge(query, n_results=3)
    logger.info(
        "Risk detection | handoff_time=%s | kb_docs_retrieved=%s",
        handoff_time,
        "yes" if rag_context else "no (KB empty or no match)",
    )

    try:
        result = await invoke_structured(risk_chain, {
            "extracted": str(extracted),
            "temporal": str(temporal),
            "handoff_time": handoff_time,
            "rag_context": rag_context or "No specific clinical knowledge retrieved. Use general medical reasoning.",
        }, RiskAssessment)

        _compute_overall_risk(result)
        logger.info(
            "Risk detection complete | alerts=%d overall_risk=%s risk_score=%d",
            len(result.alerts),
            result.overall_risk,
            result.risk_score,
        )
        return result

    except Exception as e:
        logger.error("Risk detection failed, returning safe fallback: %s", e)
        return RiskAssessment(alerts=[], overall_risk=RiskSeverity.LOW, risk_score=0)
