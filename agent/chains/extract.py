import logging
from langchain_core.prompts import ChatPromptTemplate
from models import ExtractedData, HandoffSummary
from chains.llm import llm, invoke_structured

logger = logging.getLogger("agent.chains.extract")

extract_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are a clinical entity extraction system for nurse handoffs.
Extract structured information and return ONLY valid JSON matching this EXACT schema:

{{
  "summary": {{
    "patient_name": "string",
    "bed": "string",
    "age": null,
    "chief_complaint": "string or null"
  }},
  "medications": [
    {{
      "name": "string",
      "dose": "string",
      "time_given": "exact phrase from transcript e.g. subah, 4 hours ago, or unknown",
      "reason": "string or null"
    }}
  ],
  "vitals": [
    {{
      "type": "BP or HR or Temp or SpO2 or RR",
      "value": "current value as string e.g. 90 or 140/90",
      "systolic": null,
      "diastolic": null,
      "trend": "stable or rising or dropping or unknown"
    }}
  ],
  "symptoms": [
    {{
      "description": "string",
      "severity": "mild or moderate or severe"
    }}
  ],
  "pending_tasks": ["string"]
}}

Rules:
- Use EXACTLY these field names — do not rename them
- summary must always be a nested object, never flat fields
- time_given: preserve the original Hindi/English phrase from transcript

BP PARSING RULES (critical):
- "140 se 90 ho gaya" = BP DROPPED from 140 to 90 → value="90", systolic=90, trend="dropping"
- "BP 140/90" = static reading → value="140/90", systolic=140, diastolic=90, trend="unknown"
- "BP badh gaya" = BP rising → trend="rising"
- "BP stable hai" → trend="stable"
- "X se Y ho gaya" always means it CHANGED from X to Y — the current value is Y

TREND DETECTION:
- "se ... ho gaya" (went from X to Y) = explicit change, detect direction
- If value went up → "rising", if went down → "dropping"
- Only use "unknown" if no directional info

- Return [] for any empty list, null for missing optional fields
- Output ONLY the JSON object, no explanation, no markdown"""),
    ("human", """Handoff Transcript:
{transcript}

Return ONLY the JSON:""")
])

extract_chain = extract_prompt | llm  # raw output — parsed by invoke_structured


async def extract_entities(transcript: str) -> ExtractedData:
    """
    Layer 1: Extract clinical entities from raw transcript.
    Handles Hindi-English mixing naturally.
    """
    logger.info("Invoking LLM for entity extraction | transcript_len=%d", len(transcript))
    try:
        result = await invoke_structured(extract_chain, {"transcript": transcript}, ExtractedData)
        logger.info(
            "Extraction complete | meds=%d vitals=%d symptoms=%d tasks=%d",
            len(result.medications),
            len(result.vitals),
            len(result.symptoms),
            len(result.pending_tasks),
        )
        return result
    except Exception as e:
        logger.error("Entity extraction failed, using fallback: %s", e)
        return ExtractedData(
            summary=HandoffSummary(patient_name="Unknown", bed="Unknown"),
            medications=[],
            vitals=[],
            symptoms=[],
            pending_tasks=[]
        )
