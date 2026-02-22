from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, EmailStr


# ─────────────────────────────────────────────────────────────────────────────
# Auth
# ─────────────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    email: EmailStr

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    email: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


# ─────────────────────────────────────────────────────────────────────────────
# Patients
# ─────────────────────────────────────────────────────────────────────────────

class PatientCreate(BaseModel):
    name: str
    bed_number: Optional[str] = None
    age: Optional[int] = None
    admission_reason: Optional[str] = None
    status: Optional[str] = "active"
    doctor: Optional[str] = None
    ward: Optional[str] = None
    allergies: Optional[List[str]] = None


class PatientUpdate(BaseModel):
    """Partial update — all fields optional."""
    name: Optional[str] = None
    bed_number: Optional[str] = None
    age: Optional[int] = None
    admission_reason: Optional[str] = None
    status: Optional[str] = None
    doctor: Optional[str] = None
    ward: Optional[str] = None
    allergies: Optional[List[str]] = None


class PatientResponse(BaseModel):
    id: int
    name: str
    bed_number: Optional[str]
    age: Optional[int]
    admission_reason: Optional[str]
    status: Optional[str]
    doctor: Optional[str]
    ward: Optional[str]
    allergies: Optional[List[str]]
    created_at: datetime

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────────────────────────────────────
# Handoffs  (audio-upload → agent pipeline → DB save)
# ─────────────────────────────────────────────────────────────────────────────

class HandoffCreate(BaseModel):
    """Used internally by the service layer; not exposed directly as an API body."""
    patient_id: int
    nurse_id: int
    shift_time: datetime
    audio_path: Optional[str] = None
    raw_transcript: Optional[str] = None
    agent_output_json: Optional[Dict[str, Any]] = None


class HandoffResponse(BaseModel):
    id: int
    patient_id: int
    nurse_id: int
    shift_time: datetime
    audio_path: Optional[str]
    raw_transcript: Optional[str]
    agent_output_json: Optional[Dict[str, Any]]
    processed_at: Optional[datetime]

    model_config = {"from_attributes": True}


class HandoffSummaryResponse(BaseModel):
    """Lightweight summary returned to the frontend after an audio upload."""
    success: bool
    handoff_id: int
    patient_name: str
    risk_level: str                  # overall_risk from agent
    top_alerts: List[str]            # alert_type strings from risks.alerts
    hinglish_narrative: str          
    full_analysis: Dict[str, Any]    


class HandoffProcessRequest(BaseModel):
    """
    Body for POST /api/handoffs/process  (text-only path, skip audio).
    The audio-upload path uses multipart form data handled in the route.
    """
    patient_id: int
    transcript: str
    handoff_time: str = "07:00 AM"


class HandoffErrorResponse(BaseModel):
    success: bool = False
    error: str
    fallback: Dict[str, Any] = {"risks": [], "alert": "Manual review required"}


class TranscriptResponse(BaseModel):
    """Simple wrapper for the raw transcript returned by /transcribe-only."""
    transcript: str


# ─────────────────────────────────────────────────────────────────────────────
# Medications History
# ─────────────────────────────────────────────────────────────────────────────

class MedicationHistoryResponse(BaseModel):
    id: int
    handoff_id: int
    patient_id: int
    med_name: str
    dose: str
    time_given: Optional[datetime]
    shift_date: datetime

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────────────────────────────────────
# Vitals History
# ─────────────────────────────────────────────────────────────────────────────

class VitalsHistoryResponse(BaseModel):
    id: int
    handoff_id: int
    patient_id: int
    vital_type: str
    value: str
    trend: Optional[str]
    recorded_at: datetime

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────────────────────────────────────
# Active Risks
# ─────────────────────────────────────────────────────────────────────────────

class ActiveRiskResponse(BaseModel):
    id: int
    patient_id: int
    risk_type: str
    severity: str
    status: str
    created_at: datetime
    resolved_at: Optional[datetime]

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────────────────────────────────────
# Dashboard  (aggregated patient view)
# ─────────────────────────────────────────────────────────────────────────────

class PatientDashboard(BaseModel):
    """Full patient summary: latest handoff + active risks + recent vitals."""
    patient: PatientResponse
    latest_handoff: Optional[HandoffResponse]
    active_risks: List[ActiveRiskResponse]
    recent_vitals: List[VitalsHistoryResponse]
    recent_medications: List[MedicationHistoryResponse]
