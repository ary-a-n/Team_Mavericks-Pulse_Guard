"""Database connection — SQLAlchemy sync engine for PulseGuard backend."""

import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()  # loads backend/.env when running locally

SQLALCHEMY_DATABASE_URL: str = os.getenv(
    "DATABASE_URL",
    "postgresql://hacky:12345678@localhost:5432/hackathon",
)

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_pre_ping=True,   # drops stale connections cleanly
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Yield a SQLAlchemy session; close after request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
