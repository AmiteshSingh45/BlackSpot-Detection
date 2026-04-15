"""
app/schemas.py
──────────────
Pydantic v2 schemas for request/response serialization.
These are what the API sends back to the Next.js frontend.
"""

from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime


# ════════════════════════════════════════════════════════════════
# UPLOAD schemas
# ════════════════════════════════════════════════════════════════
class UploadBase(BaseModel):
    original_filename: str
    file_type: str


class UploadResponse(BaseModel):
    id: int
    filename: str
    original_filename: str
    file_type: str
    uploaded_at: datetime
    pipeline_started: Optional[datetime] = None
    pipeline_ended: Optional[datetime] = None
    status: str
    record_count: Optional[int] = None
    blackspot_count: Optional[int] = None
    segment_count: Optional[int] = None
    error_message: Optional[str] = None
    # Metadata tagging (v3)
    upload_label:  Optional[str] = None
    upload_year:   Optional[int] = None
    upload_source: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class UploadListResponse(BaseModel):
    total: int
    uploads: List[UploadResponse]


# ════════════════════════════════════════════════════════════════
# ACCIDENT schemas
# ════════════════════════════════════════════════════════════════
class AccidentResponse(BaseModel):
    id: int
    upload_id: int
    sr_no: Optional[int] = None
    date: Optional[datetime] = None
    location_chainage: Optional[str] = None
    accident_location: Optional[str] = None
    nature: Optional[str] = None
    classification: Optional[str] = None
    causes: Optional[str] = None
    road_condition: Optional[str] = None
    weather: Optional[str] = None
    vehicle_type: Optional[str] = None
    fatal: int = 0
    grievous: int = 0
    minor: int = 0
    chainage_km: Optional[float] = None
    year: Optional[int] = None
    month: Optional[int] = None
    time_of_day: Optional[str] = None
    season: Optional[str] = None
    severity_score: float = 0.0
    severity_label: Optional[str] = None
    segment_500m: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


# ════════════════════════════════════════════════════════════════
# SEGMENT schemas
# ════════════════════════════════════════════════════════════════
class SegmentResponse(BaseModel):
    id: int
    upload_id: int
    segment_500m: float
    total_accidents: int
    total_fatal: int
    total_grievous: int
    total_minor: int
    total_severity: float
    avg_severity: float
    accident_rate: float
    years_active: int
    dominant_nature: Optional[str] = None
    dominant_cause: Optional[str] = None
    dominant_vehicle: Optional[str] = None
    dominant_time: Optional[str] = None
    locations: Optional[str] = None
    criteria_a: bool
    criteria_b: bool
    criteria_c: bool
    criteria_d: bool
    criteria_e: bool
    criteria_count: int
    is_blackspot: bool
    is_watch_zone: bool
    risk_tier: Optional[str] = None
    blackspot_rank_score: float
    cluster_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class SegmentListResponse(BaseModel):
    total: int
    segments: List[SegmentResponse]


# ════════════════════════════════════════════════════════════════
# BLACKSPOT schemas
# ════════════════════════════════════════════════════════════════
class BlackspotResponse(BaseModel):
    id: int
    upload_id: int
    segment_id: int
    segment_500m: float
    rank: Optional[int] = None
    total_accidents: int
    total_fatal: int
    total_grievous: int
    total_severity: float
    accident_rate: float
    criteria_count: int
    risk_tier: Optional[str] = None
    blackspot_rank_score: float
    dominant_cause: Optional[str] = None
    dominant_nature: Optional[str] = None
    dominant_vehicle: Optional[str] = None
    dominant_time: Optional[str] = None
    locations: Optional[str] = None
    cluster_id: Optional[int] = None
    detected_at: datetime
    # v3 additions
    confidence_score: Optional[float] = None
    latitude:         Optional[float] = None
    longitude:        Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class BlackspotDetailResponse(BlackspotResponse):
    """
    Extended blackspot response returned by GET /blackspots/{id}.
    Includes criteria flags + thresholds (from joined Segment)
    and inline recommendations — single round-trip for full detail.
    """
    # IRC criteria boolean flags
    criteria_a: bool = False
    criteria_b: bool = False
    criteria_c: bool = False
    criteria_d: bool = False
    criteria_e: bool = False
    # Actual thresholds used (audit trail)
    accident_threshold:  Optional[float] = None
    severity_threshold:  Optional[float] = None
    fatal_threshold:     Optional[float] = None
    grievous_threshold:  Optional[float] = None
    rate_threshold:      Optional[float] = None
    # Inline recommendations
    recommendations: List["InlineRecommendation"] = []


class BlackspotListResponse(BaseModel):
    total: int
    blackspots: List[BlackspotResponse]


# ════════════════════════════════════════════════════════════════
# ANALYTICS / STATS schemas
# ════════════════════════════════════════════════════════════════
class DashboardStats(BaseModel):
    """Top-level KPI cards — mirrors Stage 5 Executive Summary."""
    total_accidents: int
    total_blackspots: int
    total_watch_zones: int
    total_fatalities: int
    total_grievous: int
    total_minor: int
    total_casualties: int
    accidents_in_blackspots: int
    blackspot_accident_pct: float
    fatalities_in_blackspots: int
    highway_km_range: Optional[float] = None
    analysis_year_start: Optional[int] = None
    analysis_year_end: Optional[int] = None
    peak_year: Optional[int] = None
    highest_risk_segment_km: Optional[float] = None
    top_cause: Optional[str] = None
    top_nature: Optional[str] = None
    top_vehicle: Optional[str] = None
    top_time: Optional[str] = None
    top_season: Optional[str] = None


class YearlyTrend(BaseModel):
    year: int
    accidents: int
    fatal: int
    grievous: int
    minor: int
    severity: float
    fatality_rate: float
    severity_per_accident: float


class CategoryCount(BaseModel):
    label: str
    count: int
    percentage: float


class MonthlyTrend(BaseModel):
    month: int
    month_name: str
    accidents: int


class ClusterSummary(BaseModel):
    cluster_id: int
    blackspot_count: int
    total_accidents: int
    total_fatal: int
    segment_kms: List[float]
    risk_tier: str


# ════════════════════════════════════════════════════════════════
# PIPELINE schemas
# ════════════════════════════════════════════════════════════════
class PipelineResult(BaseModel):
    upload_id: int
    status: str
    message: str
    record_count: Optional[int] = None
    segment_count: Optional[int] = None
    blackspot_count: Optional[int] = None
    watch_zone_count: Optional[int] = None
    duration_seconds: Optional[float] = None


class PipelineTriggerResponse(BaseModel):
    message: str
    upload_id: int
    status: str


# ════════════════════════════════════════════════════════════════
# PREDICT schemas
# ════════════════════════════════════════════════════════════════
class PredictRequest(BaseModel):
    """Body for POST /predict. upload_id is optional; omit for latest run."""
    chainage_km:       float
    hour:              Optional[int]   = None  # 0–23
    weather_condition: Optional[str]  = None  # e.g. 'Rain' — overrides live fetch
    upload_id:         Optional[int]  = None  # defaults to latest completed


class InlineRecommendation(BaseModel):
    priority:  str
    category:  str
    action:    str
    rationale: str


class PredictResponse(BaseModel):
    chainage_km:         float
    segment_500m:        float
    latitude:            float
    longitude:           float
    risk_score:          float
    risk_tier:           str
    is_blackspot:        bool
    total_accidents:     int
    total_fatal:         int
    dominant_cause:      Optional[str] = None
    dominant_time:       Optional[str] = None
    weather_condition:   str
    weather_multiplier:  float
    adjusted_risk_score: float
    recommendations:     List[InlineRecommendation] = []
    alert_triggered:     bool


# ════════════════════════════════════════════════════════════════
# ALERT schemas
# ════════════════════════════════════════════════════════════════
class AlertResponse(BaseModel):
    id:                int
    blackspot_id:      int
    upload_id:         int
    segment_500m:      float
    latitude:          Optional[float] = None
    longitude:         Optional[float] = None
    risk_tier:         str
    risk_score:        float
    alert_type:        str
    message:           str
    weather_condition: Optional[str] = None
    acknowledged:      bool
    acknowledged_at:   Optional[datetime] = None
    triggered_at:      datetime
    # v3
    priority_score:    Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class AlertListResponse(BaseModel):
    total:  int
    alerts: List[AlertResponse]


class AlertSummary(BaseModel):
    total_alerts:   int
    unread_count:   int
    tier_breakdown: dict[str, int]


# ════════════════════════════════════════════════════════════════
# RECOMMENDATION schemas
# ════════════════════════════════════════════════════════════════
class RecommendationResponse(BaseModel):
    id:           int
    blackspot_id: int
    upload_id:    int
    priority:     str
    category:     str
    action:       str
    rationale:    str
    created_at:   datetime

    model_config = ConfigDict(from_attributes=True)


class RecommendationListResponse(BaseModel):
    total:           int
    recommendations: List[RecommendationResponse]


class RecommendationSummary(BaseModel):
    total:       int
    by_category: dict[str, int]
    by_priority: dict[str, int]


# ════════════════════════════════════════════════════════════════
# WEATHER schemas
# ════════════════════════════════════════════════════════════════
class WeatherResponse(BaseModel):
    latitude:        float
    longitude:       float
    temperature:     Optional[float] = None  # °C
    condition:       str              # e.g. "Rain"
    description:     str              # e.g. "moderate rain"
    humidity:        Optional[int]   = None  # %
    wind_speed:      Optional[float] = None  # m/s
    visibility_km:   Optional[float] = None
    risk_multiplier: float            # 1.0 – 1.5
    source:          str              # openweather | cache | fallback


# ════════════════════════════════════════════════════════════════
# INSIGHTS + PERSISTENT BLACKSPOTS (v3 SDSS schemas)
# ════════════════════════════════════════════════════════════════

class InsightItem(BaseModel):
    """
    A single auto-generated plain-language insight string
    derived from the analytics data.
    """
    metric:     str                  # e.g. "accidents"
    text:       str                  # e.g. "Accidents ↓ 12.3% from 2022 to 2023"
    trend:      str                  # "up" | "down" | "neutral"
    value:      Optional[float] = None
    pct_change: Optional[float] = None


class PersistentBlackspot(BaseModel):
    """
    A blackspot location that appears across multiple uploads.
    Chronic = upload_count >= 3 AND max tier >= HIGH.
    """
    segment_500m:  float
    upload_count:  int
    upload_ids:    List[int]
    upload_labels: List[Optional[str]]
    risk_tiers:    List[str]
    max_risk_tier: str
    avg_accidents: float
    is_chronic:    bool              # upload_count >= 3


class DataFreshness(BaseModel):
    """Returned by GET /analytics/freshness for the UI freshness badge."""
    last_upload_at:       Optional[datetime] = None
    last_completed_at:    Optional[datetime] = None
    latest_upload_label:  Optional[str]      = None
    total_uploads:        int                = 0
    total_blackspots:     int                = 0
