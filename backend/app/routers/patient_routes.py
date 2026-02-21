from __future__ import annotations

import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models, schemas, auth
from app.database import get_db

logger = logging.getLogger("backend.patient_routes")

router = APIRouter(prefix="/api/patients", tags=["Patients"])


# ─────────────────────────────────────────────────────────────────────────────
# CRUD
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/",
    response_model=schemas.PatientResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new patient.",
)
def create_patient(
    patient: schemas.PatientCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> schemas.PatientResponse:
    new_patient = models.Patient(**patient.model_dump())
    db.add(new_patient)
    db.commit()
    db.refresh(new_patient)
    logger.info("Patient created | id=%d | name=%s", new_patient.id, new_patient.name)
    return new_patient


@router.get(
    "/",
    response_model=List[schemas.PatientResponse],
    summary="List all patients.",
)
def list_patients(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> List[schemas.PatientResponse]:
    return db.query(models.Patient).order_by(models.Patient.created_at.desc()).all()


@router.get(
    "/{patient_id}",
    response_model=schemas.PatientResponse,
    summary="Get a patient by ID.",
)
def get_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> schemas.PatientResponse:
    patient = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    return patient


@router.put(
    "/{patient_id}",
    response_model=schemas.PatientResponse,
    summary="Update patient details (partial update supported).",
)
def update_patient(
    patient_id: int,
    updates: schemas.PatientUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> schemas.PatientResponse:
    patient = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

    for field, value in updates.model_dump(exclude_none=True).items():
        setattr(patient, field, value)

    db.commit()
    db.refresh(patient)
    return patient


# ─────────────────────────────────────────────────────────────────────────────
# Dashboard (aggregate view)
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/{patient_id}/dashboard",
    response_model=schemas.PatientDashboard,
    summary="Full patient dashboard: latest handoff, active risks, recent vitals & meds.",
)
def get_patient_dashboard(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> schemas.PatientDashboard:
    patient = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

    latest_handoff = (
        db.query(models.Handoff)
        .filter(models.Handoff.patient_id == patient_id)
        .order_by(models.Handoff.shift_time.desc())
        .first()
    )

    active_risks = (
        db.query(models.ActiveRisk)
        .filter(
            models.ActiveRisk.patient_id == patient_id,
            models.ActiveRisk.status == "active",
        )
        .all()
    )

    recent_vitals = (
        db.query(models.VitalsHistory)
        .filter(models.VitalsHistory.patient_id == patient_id)
        .order_by(models.VitalsHistory.recorded_at.desc())
        .limit(20)
        .all()
    )

    recent_medications = (
        db.query(models.MedicationHistory)
        .filter(models.MedicationHistory.patient_id == patient_id)
        .order_by(models.MedicationHistory.shift_date.desc())
        .limit(20)
        .all()
    )

    return schemas.PatientDashboard(
        patient=schemas.PatientResponse.model_validate(patient),
        latest_handoff=schemas.HandoffResponse.model_validate(latest_handoff) if latest_handoff else None,
        active_risks=[schemas.ActiveRiskResponse.model_validate(r) for r in active_risks],
        recent_vitals=[schemas.VitalsHistoryResponse.model_validate(v) for v in recent_vitals],
        recent_medications=[schemas.MedicationHistoryResponse.model_validate(m) for m in recent_medications],
    )


# ─────────────────────────────────────────────────────────────────────────────
# Sub-resource endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/{patient_id}/vitals",
    response_model=List[schemas.VitalsHistoryResponse],
    summary="Vitals history for a patient.",
)
def get_patient_vitals(
    patient_id: int,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> List[schemas.VitalsHistoryResponse]:
    return (
        db.query(models.VitalsHistory)
        .filter(models.VitalsHistory.patient_id == patient_id)
        .order_by(models.VitalsHistory.recorded_at.desc())
        .limit(limit)
        .all()
    )


@router.get(
    "/{patient_id}/medications",
    response_model=List[schemas.MedicationHistoryResponse],
    summary="Medication history for a patient.",
)
def get_patient_medications(
    patient_id: int,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> List[schemas.MedicationHistoryResponse]:
    return (
        db.query(models.MedicationHistory)
        .filter(models.MedicationHistory.patient_id == patient_id)
        .order_by(models.MedicationHistory.shift_date.desc())
        .limit(limit)
        .all()
    )


@router.get(
    "/{patient_id}/risks",
    response_model=List[schemas.ActiveRiskResponse],
    summary="Active risks for a patient.",
)
def get_patient_risks(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> List[schemas.ActiveRiskResponse]:
    return (
        db.query(models.ActiveRisk)
        .filter(
            models.ActiveRisk.patient_id == patient_id,
            models.ActiveRisk.status == "active",
        )
        .order_by(models.ActiveRisk.created_at.desc())
        .all()
    )
