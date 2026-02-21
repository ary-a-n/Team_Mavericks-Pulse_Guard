from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Float
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB

from app.database import Base

# ----------------- Existing Auth Model -----------------

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)

    # A nurse can have many handoffs
    handoffs = relationship("Handoff", back_populates="nurse")


# ----------------- Pulse Guard Models -----------------

class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    bed_number = Column(String, index=True)
    age = Column(Integer)
    admission_reason = Column(String)
    status=Column(String)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    handoffs = relationship("Handoff", back_populates="patient", cascade="all, delete-orphan")
    medications = relationship("MedicationHistory", back_populates="patient", cascade="all, delete-orphan")
    vitals = relationship("VitalsHistory", back_populates="patient", cascade="all, delete-orphan")
    risks = relationship("ActiveRisk", back_populates="patient", cascade="all, delete-orphan")


class Handoff(Base):
    __tablename__ = "handoffs"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    nurse_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    shift_time = Column(DateTime, nullable=False)
    audio_path = Column(String, nullable=True)
    raw_transcript = Column(String, nullable=True)
    processed_at = Column(DateTime, nullable=True)
    agent_output_json = Column(JSONB, nullable=True) # Native Postgres JSONB

    # Relationships
    patient = relationship("Patient", back_populates="handoffs")
    nurse = relationship("User", back_populates="handoffs")
    medications = relationship("MedicationHistory", back_populates="handoff")
    vitals = relationship("VitalsHistory", back_populates="handoff")


class MedicationHistory(Base):
    __tablename__ = "medications_history"

    id = Column(Integer, primary_key=True, index=True)
    handoff_id = Column(Integer, ForeignKey("handoffs.id"), nullable=False)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    med_name = Column(String, nullable=False)
    dose = Column(String, nullable=False)
    time_given = Column(DateTime, nullable=True)
    shift_date = Column(DateTime, nullable=False)

    # Relationships
    patient = relationship("Patient", back_populates="medications")
    handoff = relationship("Handoff", back_populates="medications")


class VitalsHistory(Base):
    __tablename__ = "vitals_history"

    id = Column(Integer, primary_key=True, index=True)
    handoff_id = Column(Integer, ForeignKey("handoffs.id"), nullable=False)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    vital_type = Column(String, nullable=False) # e.g., BP, HR, Temp
    value = Column(String, nullable=False)      # String allows "120/80"
    trend = Column(String, nullable=True)
    recorded_at = Column(DateTime, nullable=False)

    # Relationships
    patient = relationship("Patient", back_populates="vitals")
    handoff = relationship("Handoff", back_populates="vitals")


class ActiveRisk(Base):
    __tablename__ = "active_risks"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    risk_type = Column(String, nullable=False)
    severity = Column(String, nullable=False)
    status = Column(String, default="active", nullable=False) # active or resolved
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    resolved_at = Column(DateTime, nullable=True)

    # Relationships
    patient = relationship("Patient", back_populates="risks")
