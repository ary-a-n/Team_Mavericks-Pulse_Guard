import asyncio
import logging
import time

from fastapi import APIRouter, HTTPException
from models import AgentOutput, HandoffRequest, QuickRiskRequest
from chains.extract import extract_entities
from chains.temporal import resolve_temporal
from chains.risk import detect_risks
from chains.omissions import analyze_omissions
from chains.summarize import generate_hinglish_summary

logger = logging.getLogger("agent.router")

router = APIRouter(prefix="/api/v1")


@router.post("/extract", response_model=AgentOutput)
async def process_handoff(body: HandoffRequest) -> AgentOutput:
    """
    Full 5-layer pipeline:

    Phase 1 (sequential):  Extract → Temporal
    Phase 2 (parallel):    Risk ∥ Omissions       [gpt-oss-20b]
    Phase 3 (sequential):  Hinglish Summary        [gemini-2.5-flash-lite]
    """
    start = time.time()
    logger.info(
        "POST /extract | handoff_time=%s | transcript_len=%d | has_context=%s",
        body.handoff_time,
        len(body.transcript),
        body.patient_context is not None,
    )

    try:
        # Phase 1 — Sequential (each depends on the previous)
        logger.info("Phase 1a | extract: entities")
        extracted = await extract_entities(body.transcript)

        logger.info("Phase 1b | temporal: resolving time references")
        temporal = await resolve_temporal(body.transcript, extracted.dict(), body.handoff_time)

        # Phase 2 — Parallel (risk and omissions are independent of each other)
        logger.info("Phase 2  | risk + omissions running in parallel [gpt-oss-20b]")
        risks, omissions = await asyncio.gather(
            detect_risks(extracted.dict(), temporal.dict(), body.handoff_time),
            analyze_omissions(
                body.transcript,
                extracted.dict(),
                {},
                context=body.patient_context or "",
            ),
        )

        # Phase 3 — Hinglish summary (depends on all previous output)
        logger.info("Phase 3  | hinglish summary [gemini-2.5-flash-lite]")
        hinglish = await generate_hinglish_summary(
            extracted.dict(),
            temporal.dict(),
            risks.dict(),
            omissions.dict(),
        )

        processing_time = int((time.time() - start) * 1000)
        logger.info(
            "Pipeline complete | overall_risk=%s | risk_score=%d | omissions=%d | ms=%d",
            risks.overall_risk,
            risks.risk_score,
            len(omissions.omissions),
            processing_time,
        )

        return AgentOutput(
            extracted=extracted,
            temporal=temporal,
            risks=risks,
            omissions=omissions,
            hinglish_summary=hinglish,
            processing_time_ms=processing_time,
        )

    except Exception as e:
        logger.exception("Pipeline failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")


@router.post("/risk")
async def quick_risk_check(body: QuickRiskRequest):
    """Quick endpoint for just risk analysis (no omissions, no summary)."""
    logger.info("POST /risk | handoff_time=%s", body.handoff_time)
    extracted = await extract_entities(body.transcript)
    temporal = await resolve_temporal(body.transcript, extracted.dict(), body.handoff_time)
    risks = await detect_risks(extracted.dict(), temporal.dict(), body.handoff_time)
    logger.info("Quick risk check complete | overall_risk=%s", risks.overall_risk)
    return risks


@router.post("/health")
async def health_check():
    return {"status": "ok", "service": "ai-agent"}
