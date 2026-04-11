"""
app/config.py
─────────────
Central configuration using Pydantic Settings.
All values are read from the .env file automatically.
"""

from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List
import os


class Settings(BaseSettings):
    # ── Database ────────────────────────────────────────────────
    DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/demodb"

    # ── Project Meta ────────────────────────────────────────────
    PROJECT_NAME: str = "Blackspot Detection API"
    API_VERSION: str = "v1"
    CORS_ORIGINS: str = "http://localhost:3000"

    # ── Pipeline Thresholds ─────────────────────────────────────
    BLACKSPOT_THRESHOLD: int = 5
    SEGMENT_LENGTH_M: int = 500
    USE_ADAPTIVE_THRESHOLDS: bool = True

    # ── IRC Severity Weights ────────────────────────────────────
    IRC_FATAL_WEIGHT: int = 5
    IRC_GRIEVOUS_WEIGHT: int = 3
    IRC_MINOR_WEIGHT: int = 1

    # ── Adaptive Criteria Percentiles ───────────────────────────
    ACCIDENT_PERCENTILE: float = 75.0
    SEVERITY_PERCENTILE: float = 75.0
    FATAL_PERCENTILE: float = 90.0
    GRIEVOUS_PERCENTILE: float = 80.0
    RATE_PERCENTILE: float = 75.0
    BLACKSPOT_MIN_CRITERIA: int = 2

    # ── Logging ─────────────────────────────────────────────────
    LOG_LEVEL: str = "INFO"

    # ── File Upload ─────────────────────────────────────────────
    UPLOAD_DIR: str = "uploads"
    MAX_FILE_SIZE_MB: int = 50

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse comma-separated CORS origins into a list."""
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]

    @property
    def max_file_size_bytes(self) -> int:
        return self.MAX_FILE_SIZE_MB * 1024 * 1024

    def ensure_upload_dir(self):
        """Create the upload directory if it doesn't exist."""
        os.makedirs(self.UPLOAD_DIR, exist_ok=True)

    model_config = {"env_file": ".env", "extra": "ignore"}


# ── Global singleton ────────────────────────────────────────────
settings = Settings()
