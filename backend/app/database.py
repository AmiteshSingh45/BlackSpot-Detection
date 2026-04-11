"""
app/database.py
───────────────
SQLAlchemy engine, session factory, and Base declaration.
All other modules import from here — never create engines elsewhere.
"""

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

# ── Engine ──────────────────────────────────────────────────────
# pool_pre_ping=True ensures stale connections are recycled automatically
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    echo=False,          # Set True for SQL query logging in dev
)

# ── Session factory ─────────────────────────────────────────────
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

# ── Base class for all ORM models ───────────────────────────────
Base = declarative_base()


# ── FastAPI dependency ──────────────────────────────────────────
def get_db():
    """
    Yields a database session and ensures it is closed after the
    request completes (whether it succeeds or raises an exception).

    Usage in routes:
        from app.database import get_db
        from sqlalchemy.orm import Session
        from fastapi import Depends

        @router.get("/example")
        def example(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
