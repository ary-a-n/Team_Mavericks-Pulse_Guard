from pydantic import BaseModel, Field, field_validator, model_validator, AliasChoices, ConfigDict
from typing import List, Optional
from enum import Enum


class HandoffRequest(BaseModel):
    """Request body for the full 4-layer pipeline (/api/v1/extract)."""
    transcript: str = Field(..., description="Raw nurse handoff transcript (Hindi/English mix supported)")
    handoff_time: str = Field("07:00 AM", description="Time when the handoff is happening, e.g. '07:00 AM'")
    patient_context: Optional[str] = Field(None, description="Optional: previous shift data or patient history")

    @field_validator("transcript")
    @classmethod
    def transcript_must_not_be_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("transcript cannot be empty")
        return v.strip()


class QuickRiskRequest(BaseModel):
    """Request body for the quick risk-only endpoint (/api/v1/risk)."""
    transcript: str = Field(..., description="Raw nurse handoff transcript")
    handoff_time: str = Field("07:00 AM", description="Time when the handoff is happening")

    @field_validator("transcript")
    @classmethod
    def transcript_must_not_be_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("transcript cannot be empty")
        return v.strip()


class Medication(BaseModel):
    """Accepts both 'time_given' and 'time' from the LLM."""
    model_config = ConfigDict(populate_by_name=True)
    name: str
    dose: Optional[str] = Field(
        default="not specified",  # LLM returns null when transcript omits dose
        validation_alias=AliasChoices("dose", "dosage", "amount"),
    )
    time_given: str = Field(
        default="unknown",
        validation_alias=AliasChoices("time_given", "time", "time given", "time_administered"),
    )
    reason: Optional[str] = None


class Vital(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    type: str = Field(validation_alias=AliasChoices("type", "vital_type", "vital"))
    value: str
    systolic: Optional[int] = None                  
    diastolic: Optional[int] = None                 
    trend: Optional[str] = Field(
        default="unknown",
        validation_alias=AliasChoices("trend", "direction", "change"),
    )


class Symptom(BaseModel):
    description: str
    severity: Optional[str] = "mild"


class TemporalEvent(BaseModel):
    event: str = Field(
        validation_alias=AliasChoices("event", "type", "event_type", "description", "event_name")
    )
    absolute_time: str = Field(validation_alias=AliasChoices("absolute_time", "time", "absolute", "resolved_time"))
    relative_original: str = Field(
        default="",
        validation_alias=AliasChoices("relative_original", "relative", "original", "time_since", "original_text"),
    )


class RiskSeverity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class RiskAlert(BaseModel):
    severity: RiskSeverity
    alert_type: str = Field(validation_alias=AliasChoices("alert_type", "type", "alert"))
    reason: str
    action_required: str = Field(
        default="Monitor closely.",
        validation_alias=AliasChoices("action_required", "action", "recommended_action"),
    )
    confidence: float = 0.8


class Omission(BaseModel):
    type: str
    severity: RiskSeverity
    reason: str
    expected_in_handoff: str = Field(
        default="",
        validation_alias=AliasChoices("expected_in_handoff", "expected", "what_was_expected"),
    )


class HandoffSummary(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    patient_name: str = Field(
        default="Unknown",
        validation_alias=AliasChoices("patient_name", "patient name", "name"),
    )
    bed: str = Field(
        default="Not stated",
        validation_alias=AliasChoices("bed", "bed_number", "bed number"),
    )
    age: Optional[int] = None
    chief_complaint: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("chief_complaint", "chief complaint", "complaint", "admission_reason"),
    )

    @field_validator("bed", mode="before")
    @classmethod
    def coerce_bed(cls, v: object) -> object:
        """LLM returns null when bed isn't mentioned — fall back gracefully."""
        if v is None or (isinstance(v, str) and not v.strip()):
            return "Not stated"
        return v

    @field_validator("patient_name", mode="before")
    @classmethod
    def coerce_patient_name(cls, v: object) -> object:
        """LLM returns null when patient name isn't mentioned — fall back gracefully."""
        if v is None or (isinstance(v, str) and not v.strip()):
            return "Unknown"
        return v


class ExtractedData(BaseModel):
    summary: HandoffSummary
    medications: List[Medication] = []
    vitals: List[Vital] = []
    symptoms: List[Symptom] = []
    pending_tasks: List[str] = []

    @model_validator(mode="before")
    @classmethod
    def handle_flat_structure(cls, data: object) -> object:
        """
        LLMs often return a flat dict instead of nesting patient info
        under 'summary'. Detect this and wrap the fields automatically.
        """
        if not isinstance(data, dict) or "summary" in data:
            return data

        summary = {
            "patient_name": (
                data.pop("patient_name", None)
                or data.pop("patient name", None)
                or data.pop("name", "Unknown")
            ),
            "bed": (
                data.pop("bed", None)
                or data.pop("bed_number", None)
                or data.pop("bed number", "Unknown")
            ),
            "age": data.pop("age", None),
            "chief_complaint": (
                data.pop("chief_complaint", None)
                or data.pop("chief complaint", None)
                or data.pop("admission_reason", None)
            ),
        }
        data["summary"] = summary
        return data


class TemporalData(BaseModel):
    handoff_time: str
    events: List[TemporalEvent] = []
    next_dose_times: List[str] = []
    calculated_times: dict = {}


class RiskAssessment(BaseModel):
    alerts: List[RiskAlert] = []
    overall_risk: RiskSeverity = RiskSeverity.LOW
    risk_score: int = 0


class OmissionAnalysis(BaseModel):
    omissions: List[Omission] = []
    high_risk_conditions_mentioned: List[str] = []
    missing_critical_items: List[str] = []


class HinglishSummary(BaseModel):
    """Layer 5: Structured Hinglish summary — one field per UI section."""
    patient_overview: str        # 1-2 line patient snapshot
    medications: List[str]       # One line per medication
    risk_alerts: List[str]       # One line per alert: "[SEVERITY] issue — action"
    missing_info: List[str]      # Top omissions, one line each
    action_items: List[str]      # Numbered-style action steps for incoming nurse


class AgentOutput(BaseModel):
    extracted: ExtractedData
    temporal: TemporalData
    risks: RiskAssessment
    omissions: OmissionAnalysis
    hinglish_summary: HinglishSummary
    processing_time_ms: int
