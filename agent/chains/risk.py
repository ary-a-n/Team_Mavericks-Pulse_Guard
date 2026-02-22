import logging
from langchain_core.prompts import ChatPromptTemplate
from models import RiskAssessment, RiskSeverity
from chains.llm import llm, invoke_structured
from chains.knowledge_base import query_clinical_knowledge

logger = logging.getLogger("agent.chains.risk")

risk_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are a clinical safety checker for nursing handoffs.
Analyze ONLY for DANGEROUS combinations that REQUIRE immediate nurse action.

RETRIEVED CLINICAL KNOWLEDGE (primary reference):
{rag_context}

CRITERIA FOR EMPTY ALERTS (stable case):
- All vitals normal: BP 100-140/60-90, HR 60-100, RR 12-20, Temp 98-99
- No new medications, dose changes, or symptoms
- No abnormal trends or pending critical labs

Return ONLY valid JSON matching this EXACT schema:

{{
  "alerts": [array — EMPTY IF NO DANGEROUS PATTERNS],
  "overall_risk": "CRITICAL" or "HIGH" or "MEDIUM" or "LOW",
  "risk_score": 100 or 75 or 50 or 25 or 0
}}

SCORING (MUST FOLLOW):
- CRITICAL = 100, HIGH = 75, MEDIUM = 50, LOW = 25, NO_ALERTS = 0
- overall_risk = highest severity alert (LOW if empty)

Output ONLY the JSON object, no explanation."""),
    ("human", """Extracted Patient Data: {extracted}
Temporal Information: {temporal}
Handoff Time: {handoff_time}

JSON only:""")
])

risk_chain = risk_prompt | llm  # Now uses CORRECT single prompt

_SCORE_MAP = {
    RiskSeverity.CRITICAL: 100,
    RiskSeverity.HIGH: 75,
    RiskSeverity.MEDIUM: 50,
    RiskSeverity.LOW: 25,
}

def _build_risk_query(extracted: dict) -> str:
    meds = [m.get("name", "") for m in extracted.get("medications", [])]
    symptoms = [s.get("description", "") for s in extracted.get("symptoms", [])]
    vitals = [f"{v.get('type', '')} {v.get('value', '')}" for v in extracted.get("vitals", [])]
    chief = extracted.get("summary", {}).get("chief_complaint", "")
    return " ".join(filter(None, meds + symptoms + vitals + [chief]))

def _compute_overall_risk(result: RiskAssessment) -> None:
    if not result.alerts:
        result.overall_risk = RiskSeverity.LOW
        result.risk_score = 0
        return
    
    severities = [alert.severity for alert in result.alerts]
    severity_order = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
    highest_severity = max(severities, key=lambda s: severity_order.index(s))
    
    result.overall_risk = highest_severity
    result.risk_score = _SCORE_MAP.get(highest_severity, 0)

async def detect_risks(extracted: dict, temporal: dict, handoff_time: str = "07:00") -> RiskAssessment:
    query = _build_risk_query(extracted)
    rag_context = query_clinical_knowledge(query, n_results=3)
    
    logger.info("Risk detection | time=%s | kb_docs=%d", handoff_time, 
                len(rag_context.split('\n')) if rag_context else 0)

    try:
        result = await invoke_structured(risk_chain, {
            "extracted": str(extracted),
            "temporal": str(temporal),
            "handoff_time": handoff_time,
            "rag_context": rag_context or "No clinical knowledge retrieved.",
        }, RiskAssessment)
        
        _compute_overall_risk(result)
        logger.info("Risk complete | alerts=%d | risk=%s | score=%d", 
                   len(result.alerts), result.overall_risk, result.risk_score)
        return result
        
    except Exception as e:
        logger.error("Risk failed: %s", e)
        return RiskAssessment(alerts=[], overall_risk=RiskSeverity.LOW, risk_score=0)
