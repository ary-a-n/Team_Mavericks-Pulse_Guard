## Backend Developer Instructions: Agent Service Integration

### 🎯 **Your Role: Orchestrator Between Frontend → Agent → Database**

```
Frontend (Audio) → Backend (You) → Agent Service → Backend (You) → PostgreSQL + Frontend
```

***

## 1. **Data Flow Overview**

```
1. Frontend POSTs audio file → /api/audio-upload
2. Backend: Whisper STT → raw transcript
3. Backend queries DB for patient_context (previous shifts)
4. Backend POSTs to Agent: {transcript, handoff_time, patient_context}
5. Agent returns AgentOutput JSON
6. Backend saves AgentOutput to DB
7. Backend returns structured data to Frontend
```

***

## 2. **PostgreSQL Schema** (Create these tables)

```sql
-- Patients (static info)
CREATE TABLE patients (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    bed VARCHAR(10),
    age INTEGER,
    admission_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Handoffs (each shift handover)
CREATE TABLE handoffs (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES patients(id),
    shift_time TIMESTAMP NOT NULL,
    nurse_id VARCHAR(100),
    audio_path VARCHAR(500),           -- S3/local file path
    raw_transcript TEXT NOT NULL,      -- Whisper output
    agent_output JSONB NOT NULL,       -- Full AgentOutput response
    processed_at TIMESTAMP DEFAULT NOW()
);

-- Medication history (for timeline)
CREATE TABLE medications_history (
    id SERIAL PRIMARY KEY,
    handoff_id INTEGER REFERENCES handoffs(id),
    patient_id INTEGER REFERENCES patients(id),
    med_name VARCHAR(255),
    dose VARCHAR(50),
    time_given TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Vitals history (for trends)
CREATE TABLE vitals_history (
    id SERIAL PRIMARY KEY,
    handoff_id INTEGER REFERENCES handoffs(id),
    patient_id INTEGER REFERENCES patients(id),
    vital_type VARCHAR(20),  -- BP, HR, Temp, RR, SpO2
    systolic INTEGER,
    diastolic INTEGER,
    value VARCHAR(20),
    trend VARCHAR(20),       -- stable/rising/dropping
    recorded_at TIMESTAMP
);
```

***

## 3. **Backend API Endpoints You Need**

### **POST /api/audio-upload** (Frontend → Backend)
```javascript
// Frontend sends this
{
  "audio": "file_blob",  // Audio file
  "patient_name": "Mrs. Gupta",
  "bed": "12",
  "handoff_time": "14:00"  // Current shift time
}
```

**Backend does:**
1. Save audio file (local/S3)
2. Whisper STT → `raw_transcript`
3. Query DB: `SELECT agent_output FROM handoffs WHERE patient_name='Mrs. Gupta' ORDER BY shift_time DESC LIMIT 2`
4. Build `patient_context`: "Previous shift: [summary of last handoff]"
5. POST to Agent Service

### **Agent Service Call** (Backend → Agent)
```python
import httpx

async def call_agent(transcript: str, handoff_time: str, patient_context: str):
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "http://localhost:8001/api/v1/extract",
            json={
                "transcript": transcript,
                "handoff_time": handoff_time,
                "patient_context": patient_context  # "COPD history, blood cultures pending"
            }
        )
        return resp.json()  # AgentOutput pydantic model
```

### **Response to Frontend** (Backend → Frontend)
```json
{
  "success": true,
  "data": {
    "patient": "Mrs. Gupta",
    "risk_level": "MEDIUM",
    "top_alerts": ["INFECTION_RISK", "ceftriaxone_iv_compatibility"],
    "hinglish_actions": "Turant IV line check karo...",  // For UI display
    "full_analysis": { /* complete AgentOutput */ }
  },
  "handoff_id": 123  // For tracking
}
```

***

## 4. **Exact Data Exchange with Agent Service**

### **You SEND to Agent** (`HandoffRequest`):
```json
{
  "transcript": "Ceftriaxone 1g subah diya tha aur azithromycin bhi start kiya hai...",
  "handoff_time": "14:00",
  "patient_context": "Known history of COPD and mild heart failure. Blood cultures sent yesterday morning pending."
}
```

### **Agent RETURNS** (`AgentOutput`):
```json
{
  "extracted": { "medications": [...], "vitals": [...] },
  "temporal": { "next_dose_times": ["22:00 - azithromycin"] },
  "risks": { "alerts": [{"severity": "HIGH", "alert_type": "ceftriaxone_iv_compatibility"}] },
  "omissions": { "omissions": [{"type": "azithromycin_qtc_interval"}] },
  "hinglish_summary": { "narrative": "Okay team, chalo suno!...", "action_items": [...] },
  "processing_time_ms": 32052
}
```

***

## 5. **Database Save Pattern**

```python
# After Agent response
async def save_handoff(agent_output: dict, patient_id: int, transcript: str):
    query = """
    INSERT INTO handoffs (patient_id, shift_time, raw_transcript, agent_output)
    VALUES ($1, $2, $3, $4)
    RETURNING id
    """
    
    handoff_id = await db.execute(query, patient_id, datetime.now(), transcript, agent_output)
    
    # Save extracted meds/vitals to history tables
    for med in agent_output["extracted"]["medications"]:
        await save_med_history(handoff_id, patient_id, med)
    
    return handoff_id
```

***

## 6. **Patient Context Generation** (Query Previous Shifts)

```python
async def get_patient_context(patient_name: str, limit: int = 2):
    query = """
    SELECT agent_output->'extracted'->>'summary' as summary,
           agent_output->'risks'->>'overall_risk' as risk_level,
           shift_time
    FROM handoffs h
    JOIN patients p ON h.patient_id = p.id
    WHERE p.name ILIKE $1
    ORDER BY shift_time DESC LIMIT $2
    """
    
    prev_shifts = await db.fetch(query, f"%{patient_name}%", limit)
    
    context = []
    for shift in prev_shifts:
        context.append(f"Shift {shift['shift_time']}: {shift['summary']}, Risk: {shift['risk_level']}")
    
    return "; ".join(context) or "No previous handoff data."
```

***

## 7. **Error Handling**

```python
try:
    agent_response = await call_agent(transcript, handoff_time, patient_context)
    
    # Save to DB
    handoff_id = await save_handoff(agent_response, patient_id, transcript)
    
    return {"success": True, "data": agent_response, "handoff_id": handoff_id}
    
except Exception as e:
    # Fallback to basic processing
    return {
        "success": False,
        "error": "Agent service unavailable",
        "fallback": {"risks": [], "alert": "Manual review required"}
    }
```

***

## 8. **FastAPI Endpoint Example**

```python
@app.post("/api/audio-upload")
async def upload_audio(audio_file: UploadFile, patient_name: str, handoff_time: str):
    # 1. Save audio
    audio_path = f"/uploads/{uuid.uuid4()}.wav"
    
    # 2. Whisper STT
    transcript = await whisper_transcribe(audio_path)
    
    # 3. Get patient context
    patient_context = await get_patient_context(patient_name)
    
    # 4. Call Agent
    agent_output = await call_agent(transcript, handoff_time, patient_context)
    
    # 5. Save to DB
    handoff_id = await save_handoff(agent_output, patient_name, transcript)
    
    return {
        "success": True,
        "handoff_id": handoff_id,
        "summary": agent_output["hinglish_summary"]["narrative"][:200] + "...",
        "top_risk": agent_output["risks"]["overall_risk"]
    }
```

***

## **Backend Checklist**

- [ ] Create PostgreSQL tables (patients, handoffs, medications_history, vitals_history)
- [ ] Whisper STT integration
- [ ] Audio file storage (local/S3)
- [ ] Agent service HTTP client
- [ ] Patient context query
- [ ] Save AgentOutput as JSONB
- [ ] Extract/save meds/vitals to history tables
- [ ] Error handling + fallbacks
- [ ] Frontend response formatting

