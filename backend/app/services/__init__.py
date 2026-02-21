"""HTTP client for communicating with the Agent service (port 8001)."""

import os
import logging
from typing import Optional

import httpx

logger = logging.getLogger("backend.agent_client")

AGENT_SERVICE_URL: str = os.getenv("AGENT_SERVICE_URL", "http://localhost:8001")
AGENT_TIMEOUT_SECONDS: int = int(os.getenv("AGENT_TIMEOUT_SECONDS", "120"))


class AgentClient:
    """Thin async wrapper around the Agent /api/v1/extract endpoint."""

    def __init__(self) -> None:
        self._base_url = AGENT_SERVICE_URL

    async def call_extract(
        self,
        transcript: str,
        handoff_time: str,
        patient_context: Optional[str] = None,
    ) -> dict:
        """
        Call the Agent's full 5-layer pipeline.

        Returns the raw AgentOutput dict on success.
        Raises httpx.HTTPStatusError or httpx.RequestError on failure.
        """
        payload = {
            "transcript": transcript,
            "handoff_time": handoff_time,
            "patient_context": patient_context or "",
        }
        context_preview = (patient_context or "")[:100].replace("\n", " ")
        logger.info(
            "Calling Agent | url=%s/api/v1/extract | transcript_len=%d | context_len=%d | context_preview=%r",
            self._base_url,
            len(transcript),
            len(patient_context or ""),
            context_preview,
        )

        async with httpx.AsyncClient(timeout=AGENT_TIMEOUT_SECONDS) as client:
            response = await client.post(
                f"{self._base_url}/api/v1/extract",
                json=payload,
            )
            response.raise_for_status()
            data: dict = response.json()
            logger.info(
                "Agent response received | overall_risk=%s | ms=%s",
                data.get("risks", {}).get("overall_risk", "unknown"),
                data.get("processing_time_ms", "?"),
            )
            return data


# Module-level singleton — import and use directly
agent_client = AgentClient()
