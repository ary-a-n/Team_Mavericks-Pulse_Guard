import { apiFetch } from "./client";

// ──────────────────────────────────────────────────────
// Types — mirrors backend schemas.py exactly
// ──────────────────────────────────────────────────────

export interface PatientResponse {
    id: number;
    name: string;
    bed_number: string | null;
    age: number | null;
    admission_reason: string | null;
    status: string | null;
    doctor: string | null;
    ward: string | null;
    allergies: string[] | null;
    created_at: string;
}

export interface PatientCreate {
    name: string;
    bed_number?: string;
    age?: number;
    admission_reason?: string;
    status?: string;
    doctor?: string;
    ward?: string;
    allergies?: string[];
}

export interface VitalsHistoryResponse {
    id: number;
    handoff_id: number;
    patient_id: number;
    vital_type: string;
    value: string;
    trend: string | null;
    recorded_at: string;
}

export interface MedicationHistoryResponse {
    id: number;
    handoff_id: number;
    patient_id: number;
    med_name: string;
    dose: string;
    time_given: string | null;
    shift_date: string;
}

export interface ActiveRiskResponse {
    id: number;
    patient_id: number;
    risk_type: string;
    severity: string;
    status: string;
    created_at: string;
    resolved_at: string | null;
}

export interface HandoffResponse {
    id: number;
    patient_id: number;
    nurse_id: number;
    shift_time: string;
    audio_path: string | null;
    raw_transcript: string | null;
    agent_output_json: Record<string, unknown> | null;
    processed_at: string | null;
}

export interface PatientDashboard {
    patient: PatientResponse;
    latest_handoff: HandoffResponse | null;
    active_risks: ActiveRiskResponse[];
    recent_vitals: VitalsHistoryResponse[];
    recent_medications: MedicationHistoryResponse[];
}

export interface HandoffSummaryResponse {
    success: boolean;
    handoff_id: number;
    patient_name: string;
    risk_level: string;
    top_alerts: string[];
    hinglish_narrative: string;
    full_analysis: Record<string, unknown>;
}

// ──────────────────────────────────────────────────────
// API functions
// ──────────────────────────────────────────────────────

/** Lists all patients. */
export function listPatients(): Promise<PatientResponse[]> {
    return apiFetch<PatientResponse[]>("/api/patients/");
}

/** Creates a single patient. */
export function createPatient(data: PatientCreate): Promise<PatientResponse> {
    return apiFetch<PatientResponse>("/api/patients/", {
        method: "POST",
        body: JSON.stringify(data),
    });
}

/** Gets the full dashboard for a patient (risks, vitals, meds, latest handoff). */
export function getPatientDashboard(id: number): Promise<PatientDashboard> {
    return apiFetch<PatientDashboard>(`/api/patients/${id}/dashboard`);
}

/** Gets a patient by ID. */
export function getPatient(id: number): Promise<PatientResponse> {
    return apiFetch<PatientResponse>(`/api/patients/${id}`);
}

/** Submits a text handoff transcript through the agent pipeline. */
export function processHandoff(
    patientId: number,
    transcript: string,
    handoffTime: string = "07:00 AM"
): Promise<HandoffSummaryResponse> {
    return apiFetch<HandoffSummaryResponse>("/api/handoffs/process", {
        method: "POST",
        body: JSON.stringify({
            patient_id: patientId,
            transcript,
            handoff_time: handoffTime,
        }),
    });
}

/** Gets all handoffs for a patient. */
export function getPatientHandoffs(
    patientId: number,
    limit = 10
): Promise<HandoffResponse[]> {
    return apiFetch<HandoffResponse[]>(
        `/api/handoffs/patient/${patientId}?limit=${limit}`
    );
}

/**
 * Uploads audio to the backend for transcription only (no agent pipeline).
 * Returns the raw transcript text for user review before submission.
 */
export async function transcribeAudio(audioBlob: Blob): Promise<string> {
    const token = localStorage.getItem("pg_token") ?? "";
    const formData = new FormData();
    const filename = audioBlob.type.includes("webm") ? "recording.webm" : "recording.ogg";
    formData.append("audio", audioBlob, filename);

    const res = await fetch("/api/handoffs/transcribe-only", {
        method: "POST",
        body: formData,
        headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `HTTP ${res.status}`);
    }

    const data: { transcript: string } = await res.json();
    return data.transcript?.trim() ?? "";
}

/**
 * Uploads audio → STT → agent pipeline in a single request.
 * Use this when you want to skip the preview/edit step.
 */
export async function uploadAudioHandoff(
    patientId: number,
    audioBlob: Blob,
    handoffTime = "07:00 AM"
): Promise<HandoffSummaryResponse> {
    const token = localStorage.getItem("pg_token") ?? "";
    const formData = new FormData();
    const filename = audioBlob.type.includes("webm") ? "recording.webm" : "recording.ogg";
    formData.append("audio", audioBlob, filename);
    formData.append("patient_id", String(patientId));
    formData.append("handoff_time", handoffTime);

    const res = await fetch("/api/handoffs/upload-audio", {
        method: "POST",
        body: formData,
        headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `HTTP ${res.status}`);
    }

    return res.json() as Promise<HandoffSummaryResponse>;
}

