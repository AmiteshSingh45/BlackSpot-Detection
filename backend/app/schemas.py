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

    model_config = ConfigDict(from_attributes=True)


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
