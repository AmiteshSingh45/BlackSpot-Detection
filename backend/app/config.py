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
    ACCIDENT_PERCENTILE: float = 85.0
    SEVERITY_PERCENTILE: float = 85.0
    FATAL_PERCENTILE: float = 90.0
    GRIEVOUS_PERCENTILE: float = 85.0
    RATE_PERCENTILE: float = 85.0
    BLACKSPOT_MIN_CRITERIA: int = 3
    BLACKSPOT_MIN_WEIGHTED_SCORE: int = 4
    BLACKSPOT_TOP_PERCENT: int = 10
    BLACKSPOT_MIN_SCORE: float = 60.0

    # ── Logging ─────────────────────────────────────────────────
    LOG_LEVEL: str = "INFO"

    # ── File Upload ─────────────────────────────────────────────
    UPLOAD_DIR: str = "uploads"
    MAX_FILE_SIZE_MB: int = 50

    # ── Alert Engine ────────────────────────────────────────────
    # Risk score threshold above which an alert is auto-generated
    ALERT_RISK_THRESHOLD: float = 70.0
    # Tiers that always trigger an alert regardless of score
    ALERT_CRITICAL_TIERS: str = "CRITICAL,HIGH"

    # ── Security (API Key, disabled by default) ───────────────────
    # Set REQUIRE_API_KEY=true in .env to enforce X-API-Key header
    REQUIRE_API_KEY: bool  = False
    API_SECRET_KEY:  str   = "changeme-replace-in-production"

    # ── Weather API (OpenWeather) ────────────────────────────────
    # Set your key in .env: OPENWEATHER_API_KEY=your_key_here
    OPENWEATHER_API_KEY: str = ""
    OPENWEATHER_BASE_URL: str = "https://api.openweathermap.org/data/2.5"
    # How long to cache weather responses (seconds)
    WEATHER_CACHE_TTL_SECONDS: int = 600

    # ── Highway Geocoding (OSM-based interpolation) ──────────────
    # OSM relation ID for the highway being analysed.
    # NH-48 (Mumbai–Delhi) = 17686 ; adjust for your highway.
    OSM_HIGHWAY_RELATION_ID: int = 17686
    # Approximate GPS centre of the highway stretch — used as
    # weather query point and fallback map centre.
    HIGHWAY_CENTER_LAT: float = 22.0
    HIGHWAY_CENTER_LNG: float = 77.0
    # Chainage offset of the highway segment start (km from road origin)
    HIGHWAY_CHAINAGE_START_KM: float = 0.0

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
