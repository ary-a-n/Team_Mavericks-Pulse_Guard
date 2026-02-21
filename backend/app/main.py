from fastapi import FastAPI
from app import models
from app.database import engine
from app.routers import auth_routes, user_routes, patient_routes

# Initialize Database
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Modular FastAPI JWT",
    description="Structured Auth System with PostgreSQL",
    version="1.0.0"
)

# Include Routers
app.include_router(auth_routes.router)
app.include_router(user_routes.router)
app.include_router(patient_routes.router)

@app.get("/")
def root():
    return {"message": "Welcome to the Secure API. Go to /docs for Swagger UI."}
