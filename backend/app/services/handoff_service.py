
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app import models
from app.services import agent_client

logger = logging.getLogger("backend.handoff_service")


class HandoffService:
    """Single-responsibility service for processing a nurse handoff."""

    def __init__(self, db: Session) -> None:
        self._db = db

    # ──────────────────────────────────────────────────────────────────────
    # Public interface
    # ──────────────────────────────────────────────────────────────────────

    async def process(
        self,
        patient_id: int,
        nurse_id: int,
        transcript: str,
        handoff_time: str,
        audio_path: Optional[str] = None,
    ) -> Dict[str, Any]:
        patient = self._get_patient_or_raise(patient_id)
        patient_context = self._build_patient_context(patient_id)

        logger.info(
            "Processing handoff | patient=%s | nurse_id=%d | transcript_len=%d | context=%r",
            patient.name,
            nurse_id,
            len(transcript),
            patient_context,
        )

        agent_output = await agent_client.call_extract(
            transcript=transcript,
            handoff_time=handoff_time,
            patient_context=patient_context,
        )

        handoff_id = self._persist(
            patient_id=patient_id,
            nurse_id=nurse_id,
            transcript=transcript,
            audio_path=audio_path,
            agent_output=agent_output,
        )

        return self._build_response(
            handoff_id=handoff_id,
            patient_name=patient.name,
            agent_output=agent_output,
        )

    # ──────────────────────────────────────────────────────────────────────
    # Private helpers
    # ──────────────────────────────────────────────────────────────────────

    def _get_patient_or_raise(self, patient_id: int) -> models.Patient:
        patient = self._db.query(models.Patient).filter(models.Patient.id == patient_id).first()
        if not patient:
            raise ValueError(f"Patient {patient_id} not found")
        return patient


    def _build_patient_context(self, patient_id: int, limit: int = 5) -> str:
        """
        Build a concise context string from the last `limit` handoffs.

        Uses JSONB path operators so Postgres returns only the 5 fields we need
        instead of loading the entire agent_output blob into Python memory.
        Limit=2 means ~2 shift-summaries; each produces ~1 short paragraph of context.
        """
        from sqlalchemy import text

        sql = text("""
            SELECT
                shift_time,
                agent_output_json -> 'extracted' -> 'summary' ->> 'chief_complaint'  AS chief_complaint,
                agent_output_json -> 'risks'     ->> 'overall_risk'                  AS overall_risk,
                agent_output_json -> 'extracted' -> 'pending_tasks'                  AS pending_tasks,
                agent_output_json -> 'extracted' -> 'medications'                    AS medications,
                agent_output_json -> 'risks'     -> 'alerts'                         AS alerts
            FROM handoffs
            WHERE patient_id = :pid
              AND agent_output_json IS NOT NULL
            ORDER BY shift_time DESC
            LIMIT :lim
        """)

        rows = self._db.execute(sql, {"pid": patient_id, "lim": limit}).fetchall()

        if not rows:
            return "No previous handoff data."

        parts: List[str] = []
        for row in rows:
            shift_str   = row.shift_time.strftime("%Y-%m-%d %H:%M") if row.shift_time else "?"
            complaint   = row.chief_complaint or "unknown complaint"
            risk        = row.overall_risk or "UNKNOWN"

            # pending tasks — stored as a JSON array of strings
            pending: List[str] = row.pending_tasks or []

            # medications — array of {name, dose, time_given}
            meds_raw: List[dict] = row.medications or []
            med_names = [m.get("name", "") for m in meds_raw if m.get("name")]

            # top alert types (max 3 to keep context short)
            alerts_raw: List[dict] = row.alerts or []
            alert_types = [a.get("alert_type", "") for a in alerts_raw[:3] if a.get("alert_type")]

            lines = [f"[Shift {shift_str}] Complaint: {complaint} | Risk: {risk}"]
            if med_names:
                lines.append(f"  Medications on that shift: {', '.join(med_names)}")
            if pending:
                lines.append(f"  Pending tasks carried forward: {'; '.join(pending)}")
            if alert_types:
                lines.append(f"  Alerts flagged: {', '.join(alert_types)}")

            parts.append("\n".join(lines))

        context = "\n\n".join(parts)
        logger.debug("Patient context built | patient_id=%d | chars=%d", patient_id, len(context))
        return context


    def _persist(
        self,
        patient_id: int,
        nurse_id: int,
        transcript: str,
        audio_path: Optional[str],
        agent_output: Dict[str, Any],
    ) -> int:
        """Save handoff + denormalized meds/vitals/risks. Returns new handoff ID."""
        now = datetime.now(timezone.utc)

        handoff = models.Handoff(
            patient_id=patient_id,
            nurse_id=nurse_id,
            shift_time=now,
            audio_path=audio_path,
            raw_transcript=transcript,
            agent_output_json=agent_output,
            processed_at=now,
        )
        self._db.add(handoff)
        self._db.flush()  # get handoff.id without committing yet

        self._save_medications(handoff.id, patient_id, agent_output, now)
        self._save_vitals(handoff.id, patient_id, agent_output, now)
        self._upsert_active_risks(patient_id, agent_output, now)

        self._db.commit()
        logger.info("Handoff persisted | handoff_id=%d | patient_id=%d", handoff.id, patient_id)
        return handoff.id

    def _save_medications(
        self,
        handoff_id: int,
        patient_id: int,
        agent_output: Dict[str, Any],
        now: datetime,
    ) -> None:
        meds: List[Dict[str, Any]] = agent_output.get("extracted", {}).get("medications", [])
        for med in meds:
            self._db.add(
                models.MedicationHistory(
                    handoff_id=handoff_id,
                    patient_id=patient_id,
                    med_name=med.get("name", "unknown"),
                    dose=med.get("dose") or "not specified",
                    time_given=None,  # raw string from LLM; skip parsing for now
                    shift_date=now,
                )
            )

    def _save_vitals(
        self,
        handoff_id: int,
        patient_id: int,
        agent_output: Dict[str, Any],
        now: datetime,
    ) -> None:
        vitals: List[Dict[str, Any]] = agent_output.get("extracted", {}).get("vitals", [])
        for vital in vitals:
            self._db.add(
                models.VitalsHistory(
                    handoff_id=handoff_id,
                    patient_id=patient_id,
                    vital_type=vital.get("type", "unknown"),
                    value=str(vital.get("value", "")),
                    trend=vital.get("trend"),
                    recorded_at=now,
                )
            )

    def _upsert_active_risks(
        self,
        patient_id: int,
        agent_output: Dict[str, Any],
        now: datetime,
    ) -> None:
        """
        Mark all previous active risks as resolved, then insert new ones from
        this handoff so the frontend always sees the freshest risk snapshot.
        """
        self._db.query(models.ActiveRisk).filter(
            models.ActiveRisk.patient_id == patient_id,
            models.ActiveRisk.status == "active",
        ).update({"status": "resolved", "resolved_at": now})

        alerts: List[Dict[str, Any]] = agent_output.get("risks", {}).get("alerts", [])
        for alert in alerts:
            self._db.add(
                models.ActiveRisk(
                    patient_id=patient_id,
                    risk_type=alert.get("alert_type", "unknown"),
                    severity=alert.get("severity", "LOW"),
                    status="active",
                    created_at=now,
                )
            )

    @staticmethod
    def _build_response(
        handoff_id: int,
        patient_name: str,
        agent_output: Dict[str, Any],
    ) -> Dict[str, Any]:
        alerts = agent_output.get("risks", {}).get("alerts", [])
        top_alerts = [a.get("alert_type", "") for a in alerts[:5]]
        narrative = agent_output.get("hinglish_summary", {}).get("patient_overview", "")

        return {
            "success": True,
            "handoff_id": handoff_id,
            "patient_name": patient_name,
            "risk_level": agent_output.get("risks", {}).get("overall_risk", "LOW"),
            "top_alerts": top_alerts,
            "hinglish_narrative": narrative,
            "full_analysis": agent_output,
        }
