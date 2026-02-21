from __future__ import annotations

import logging
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import models
from app.database import engine
from app.routers import auth_routes, user_routes, patient_routes, handoff_routes

# ─────────────────────────────────────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,
)
logger = logging.getLogger("backend.main")

# ─────────────────────────────────────────────────────────────────────────────
# DB — auto-create tables (dev convenience; use Alembic for prod)
# ─────────────────────────────────────────────────────────────────────────────

models.Base.metadata.create_all(bind=engine)

# ─────────────────────────────────────────────────────────────────────────────
# App
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="PulseGuard Backend",
    description="Orchestrator: Frontend → Agent → PostgreSQL",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────────────────────────────────────
# Routers
# ─────────────────────────────────────────────────────────────────────────────

app.include_router(auth_routes.router)
app.include_router(user_routes.router)
app.include_router(patient_routes.router)
app.include_router(handoff_routes.router)


# ─────────────────────────────────────────────────────────────────────────────
# Root
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
def root() -> dict:
    return {
        "service": "PulseGuard Backend",
        "status": "running",
        "docs": "/docs",
        "endpoints": {
            "auth": ["/auth/register", "/auth/login"],
            "users": ["/users/me"],
            "patients": [
                "/api/patients/",
                "/api/patients/{id}",
                "/api/patients/{id}/dashboard",
                "/api/patients/{id}/vitals",
                "/api/patients/{id}/medications",
                "/api/patients/{id}/risks",
            ],
            "handoffs": [
                "/api/handoffs/process",
                "/api/handoffs/{id}",
                "/api/handoffs/patient/{id}",
            ],
        },
    }


@app.get("/health", tags=["Health"])
def health() -> dict:
    return {"status": "ok"}
