from dotenv import load_dotenv
load_dotenv()  # must be before any chain imports so MEGALLM_API_KEY is set

import logging
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,
)

# Suppress noisy third-party loggers
for _noisy in ("httpx", "sentence_transformers", "huggingface_hub", "chromadb.telemetry", "openai._base_client"):
    logging.getLogger(_noisy).setLevel(logging.ERROR)

logger = logging.getLogger("agent.main")

app = FastAPI(
    title="Nurse Handoff AI Agent",
    description="4-layer clinical intelligence for nurse handoffs",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(router.router)

@app.on_event("startup")
async def on_startup() -> None:
    logger.info("Agent starting up")


@app.get("/")
async def root():
    return {
        "message": "Agent",
        "layers": ["extract", "temporal", "risk", "omissions"],
        "endpoints": ["/api/v1/extract", "/api/v1/risk", "/api/v1/health"]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
