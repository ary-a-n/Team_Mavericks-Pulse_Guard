from __future__ import annotations

import logging
from typing import List

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app import models, schemas, auth
from app.database import get_db
from app.services.handoff_service import HandoffService
from app.services.transcription_service import transcription_service

logger = logging.getLogger("backend.handoff_routes")

ALLOWED_AUDIO_CONTENT_TYPES = {
    "audio/wav",
    "audio/wave",
    "audio/x-wav",
    "audio/webm",
    "audio/ogg",
    "application/octet-stream",  # some browsers send this for wav blobs
}

router = APIRouter(prefix="/api/handoffs", tags=["Handoffs"])


@router.post(
    "/process",
    response_model=schemas.HandoffSummaryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Process a transcript through the agent pipeline and save the result.",
)
async def process_handoff(
    body: schemas.HandoffProcessRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> schemas.HandoffSummaryResponse:
    service = HandoffService(db)
    try:
        result = await service.process(
            patient_id=body.patient_id,
            nurse_id=current_user.id,
            transcript=body.transcript,
            handoff_time=body.handoff_time,
            audio_path=None,
        )
        return schemas.HandoffSummaryResponse(**result)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        logger.exception("Handoff processing failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Agent service error: {exc}",
        )


# ─────────────────────────────────────────────────────────────────────────────
# Audio upload → STT → agent pipeline
# ─────────────────────────────────────────────────────────────────────────────


@router.post(
    "/upload-audio",
    response_model=schemas.HandoffSummaryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Transcribe audio via mlx_audio STT then run agent pipeline.",
)
async def upload_audio_handoff(
    audio: UploadFile = File(..., description="WAV or WebM audio recording"),
    patient_id: int = Form(...),
    handoff_time: str = Form("07:00 AM"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> schemas.HandoffSummaryResponse:
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded audio file is empty.",
        )

    suffix = _audio_suffix(audio.content_type, audio.filename)

    logger.info(
        "Audio upload | patient_id=%d | filename=%s | content_type=%s | bytes=%d",
        patient_id, audio.filename, audio.content_type, len(audio_bytes),
    )

    try:
        transcript = await transcription_service.transcribe(audio_bytes, suffix=suffix)
    except RuntimeError as exc:
        logger.exception("Transcription failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Transcription error: {exc}",
        )

    if not transcript.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="STT returned an empty transcript — audio may be silent or too short.",
        )

    logger.info("Transcript obtained | chars=%d | preview=%.80r", len(transcript), transcript)

    service = HandoffService(db)
    try:
        result = await service.process(
            patient_id=patient_id,
            nurse_id=current_user.id,
            transcript=transcript,
            handoff_time=handoff_time,
            audio_path=None,
        )
        return schemas.HandoffSummaryResponse(**result)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        logger.exception("Handoff processing failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Agent service error: {exc}",
        )


@router.post(
    "/transcribe-only",
    response_model=schemas.TranscriptResponse,
    status_code=status.HTTP_200_OK,
    summary="Transcribe audio and return raw transcript text (no agent pipeline).",
)
async def transcribe_only(
    audio: UploadFile = File(..., description="WAV or WebM audio recording"),
    current_user: models.User = Depends(auth.get_current_user),
) -> schemas.TranscriptResponse:
    """Preview-before-submit: returns the transcript so the user can edit it before sending to the agent."""
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded audio file is empty.",
        )

    suffix = _audio_suffix(audio.content_type, audio.filename)

    try:
        transcript = await transcription_service.transcribe(audio_bytes, suffix=suffix)
    except RuntimeError as exc:
        logger.exception("Transcription failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Transcription error: {exc}",
        )

    return schemas.TranscriptResponse(transcript=transcript)


def _audio_suffix(content_type: str | None, filename: str | None) -> str:
    """Derive a file suffix from MIME type or original filename, defaulting to .wav."""
    if filename:
        from pathlib import Path
        ext = Path(filename).suffix.lower()
        if ext in {".wav", ".webm", ".ogg", ".mp3", ".m4a"}:
            return ext
    ct = (content_type or "").lower()
    if "webm" in ct:
        return ".webm"
    if "ogg" in ct:
        return ".ogg"
    return ".wav"


@router.get(
    "/patient/{patient_id}",
    response_model=List[schemas.HandoffResponse],
    summary="Get all handoffs for a patient, newest first.",
)
def get_patient_handoffs(
    patient_id: int,
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> List[schemas.HandoffResponse]:
    rows = (
        db.query(models.Handoff)
        .filter(models.Handoff.patient_id == patient_id)
        .order_by(models.Handoff.shift_time.desc())
        .limit(limit)
        .all()
    )
    return rows


@router.get(
    "/{handoff_id}",
    response_model=schemas.HandoffResponse,
    summary="Get a single handoff by ID.",
)
def get_handoff(
    handoff_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> schemas.HandoffResponse:
    row = db.query(models.Handoff).filter(models.Handoff.id == handoff_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Handoff not found")
    return row
