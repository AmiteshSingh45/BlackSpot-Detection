"""
app/main.py
────────────
FastAPI application entry point.

Start the server:
  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

Swagger UI: http://localhost:8000/docs
ReDoc:       http://localhost:8000/redoc
"""

import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from app.config import settings
from app.database import Base, engine
from app.routes import upload, blackspots, segments, analytics


# ════════════════════════════════════════════════════════════════
# LOGGING SETUP
# ════════════════════════════════════════════════════════════════

logger.remove()   # Remove default loguru handler
logger.add(
    sys.stdout,
    level=settings.LOG_LEVEL,
    format=(
        "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
        "<level>{level: <8}</level> | "
        "<cyan>{name}</cyan>:<cyan>{line}</cyan> — "
        "<level>{message}</level>"
    ),
    colorize=True,
)
# File logging — only if logs directory exists
import os
if os.path.isdir("logs"):
    logger.add(
        "logs/app.log",
        level="DEBUG",
        rotation="10 MB",
        retention="30 days",
        compression="zip",
    )


# ════════════════════════════════════════════════════════════════
# LIFESPAN — startup + shutdown
# ════════════════════════════════════════════════════════════════

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Run on startup:
      1. Create all database tables (safe — does nothing if they exist)
      2. Ensure upload directory exists
    """
    logger.info("🚀 Starting Blackspot Detection API...")

    # Auto-create tables (equivalent to Alembic for simple setups)
    try:
        Base.metadata.create_all(bind=engine)
        logger.success("✅ Database tables created / verified")
    except Exception as e:
        logger.error(f"❌ Database connection failed: {e}")
        logger.warning("Continuing without DB — check DATABASE_URL in .env")

    # Ensure upload folder exists
    settings.ensure_upload_dir()
    logger.info(f"📂 Upload directory: {settings.UPLOAD_DIR}")

    yield

    logger.info("🔒 Shutting down Blackspot Detection API")


# ════════════════════════════════════════════════════════════════
# APP INSTANCE
# ════════════════════════════════════════════════════════════════

app = FastAPI(
    title       = settings.PROJECT_NAME,
    description = (
        "Production-ready REST API for Road Accident Blackspot Detection.\n\n"
        "**Pipeline stages:**\n"
        "1. Data Ingestion (Excel / CSV / JSON)\n"
        "2. Preprocessing & Feature Engineering (IRC weights, chainage extraction)\n"
        "3. 500m Road Segmentation\n"
        "4. Adaptive Blackspot Detection (5 criteria + DBSCAN clustering)\n"
        "5. Statistical Analytics & Dashboard KPIs\n\n"
        "Built for NH-48 accident data, compatible with any Indian highway dataset."
    ),
    version     = settings.API_VERSION,
    docs_url    = "/docs",
    redoc_url   = "/redoc",
    lifespan    = lifespan,
)


# ════════════════════════════════════════════════════════════════
# CORS — allow Next.js frontend (localhost:3000)
# ════════════════════════════════════════════════════════════════

app.add_middleware(
    CORSMiddleware,
    allow_origins     = settings.cors_origins_list,
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)


# ════════════════════════════════════════════════════════════════
# ROUTERS
# ════════════════════════════════════════════════════════════════

API_PREFIX = f"/api/{settings.API_VERSION}"

app.include_router(upload.router,     prefix=API_PREFIX)
app.include_router(blackspots.router, prefix=API_PREFIX)
app.include_router(segments.router,   prefix=API_PREFIX)
app.include_router(analytics.router,  prefix=API_PREFIX)


# ════════════════════════════════════════════════════════════════
# ROOT + HEALTH ENDPOINTS
# ════════════════════════════════════════════════════════════════

@app.get("/", tags=["Health"])
def root():
    return {
        "project":  settings.PROJECT_NAME,
        "version":  settings.API_VERSION,
        "status":   "running",
        "docs":     "/docs",
        "endpoints": {
            "upload":     f"{API_PREFIX}/uploads",
            "blackspots": f"{API_PREFIX}/blackspots",
            "segments":   f"{API_PREFIX}/segments",
            "analytics":  f"{API_PREFIX}/analytics/stats",
        },
    }


@app.get("/health", tags=["Health"])
def health_check():
    """
    Lightweight health check endpoint.
    Returns 200 OK if the API is running.
    Can be extended to check DB connectivity.
    """
    from app.database import engine
    try:
        with engine.connect() as conn:
            conn.execute(__import__("sqlalchemy").text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {e}"

    return {
        "status":    "healthy",
        "database":  db_status,
        "api":       settings.API_VERSION,
    }
