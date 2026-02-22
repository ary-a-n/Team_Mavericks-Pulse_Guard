# Team Mavericks - Pulse Guard

**Pulse Guard** is an intelligent ICU Patient Monitoring and Handoff system designed to streamline the clinical handoff process for healthcare professionals. 

It enables nurses and doctors to seamlessly navigate complex ICU data, record audio handoffs, and automatically process transcripts via an AI pipeline to discover clinical insights, omissions, and perform risk analysis. 
---

## 🌟 Key Features
- **🎙️ Agent-Powered Handoffs:** Audio recordings of nurse/doctor handoffs are transcribed and analyzed to extract key structured data, detect omissions, and assess patient risks on the fly.
- **⚕️ Detailed Patient Dashboard:** A centralized, sleek view of all ICU patients displaying real-time vitals, medication history, allergies, and admission reasons.
- **🕒 AI Temporal Reasoning:** Flags critical patient situations and maps out medication dosing schedules to predict clinical changes effectively.

## 🏗️ Architecture Stack
- **Frontend:** React, Vite, Tailwind CSS, TypeScript (Built with Shadcn-UI and Lucide Icons)
- **Backend:** FastAPI, Python, PostgreSQL server
- **AI Agent Service:** Langchain, Python, Chroma DB, MegaLLM API
- **Infrastructure:** Docker & Docker Compose (Postgres 16 Alpine container)

---

## 🚀 Quick Start Guide

### 1. Start the PostgreSQL Database
Ensure Docker is installed and running on your machine.
```bash
docker-compose up -d
```

### 2. Run the Backend (FastAPI)
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### 3. Start the AI Agent Service
```bash
cd agent
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
# Ensure your .env has the required API keys (e.g. MEGA_LLM details)
python main.py
```

### 4. Launch the Frontend
```bash
cd frontend
npm install
npm run dev
```

Visit the application locally in your browser to interact with the ICU Dashboard!

---

*Made for Makeathon 8 by Team Mavericks.*
