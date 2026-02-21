from __future__ import annotations

import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models, schemas, auth
from app.database import get_db
from app.services.handoff_service import HandoffService

logger = logging.getLogger("backend.handoff_routes")

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
