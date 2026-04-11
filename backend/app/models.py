"""
app/models.py
─────────────
SQLAlchemy ORM models — these define the PostgreSQL table structure.

Tables:
  uploads   → One row per file uploaded
  accidents → Raw accident records (linked to an upload)
  segments  → Aggregated 500m segments with risk analysis
  blackspots→ Detected blackspot records (subset of segments)
"""

from sqlalchemy import (
    Column, Integer, Float, String, Boolean,
    DateTime, Text, ForeignKey, BigInteger
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


# ════════════════════════════════════════════════════════════════
# 1. UPLOADS — tracks every file upload and pipeline run
# ════════════════════════════════════════════════════════════════
class Upload(Base):
    __tablename__ = "uploads"

    id               = Column(Integer, primary_key=True, index=True)
    filename         = Column(String(255), nullable=False)   # saved on disk
    original_filename= Column(String(255), nullable=False)   # user's file name
    file_type        = Column(String(10),  nullable=False)   # xlsx / csv / json
    uploaded_at      = Column(DateTime(timezone=True), server_default=func.now())
    pipeline_started = Column(DateTime(timezone=True), nullable=True)
    pipeline_ended   = Column(DateTime(timezone=True), nullable=True)
    status           = Column(String(20), default="pending")
    # Status values: pending | processing | completed | failed
    record_count     = Column(Integer, nullable=True)
    blackspot_count  = Column(Integer, nullable=True)
    segment_count    = Column(Integer, nullable=True)
    error_message    = Column(Text, nullable=True)

    # ── Relationships ────────────────────────────────────────────
    accidents  = relationship("Accident",  back_populates="upload",
                               cascade="all, delete-orphan")
    segments   = relationship("Segment",   back_populates="upload",
                               cascade="all, delete-orphan")
    blackspots = relationship("Blackspot", back_populates="upload",
                               cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Upload id={self.id} file={self.original_filename} status={self.status}>"


# ════════════════════════════════════════════════════════════════
# 2. ACCIDENTS — one row per raw accident record from the Excel
# ════════════════════════════════════════════════════════════════
class Accident(Base):
    __tablename__ = "accidents"

    id                = Column(BigInteger, primary_key=True, index=True)
    upload_id         = Column(Integer, ForeignKey("uploads.id",
                                ondelete="CASCADE"), nullable=False, index=True)

    # ── Original notebook columns ────────────────────────────────
    sr_no             = Column(Integer,    nullable=True)
    date              = Column(DateTime,   nullable=True)
    time              = Column(String(20), nullable=True)
    location_chainage = Column(String(100),nullable=True)
    accident_location = Column(Text,       nullable=True)
    nature            = Column(String(100),nullable=True)
    classification    = Column(String(100),nullable=True)
    causes            = Column(String(200),nullable=True)
    road_features     = Column(String(100),nullable=True)
    road_condition    = Column(String(100),nullable=True)
    intersection      = Column(String(100),nullable=True)
    weather           = Column(String(100),nullable=True)
    vehicle_type      = Column(String(150),nullable=True)
    fatal             = Column(Integer,    default=0)
    grievous          = Column(Integer,    default=0)
    minor             = Column(Integer,    default=0)
    non_injured       = Column(Integer,    default=0)
    source_file       = Column(String(255),nullable=True)

    # ── Stage 2 engineered features ──────────────────────────────
    chainage_km       = Column(Float,      nullable=True)
    year              = Column(Integer,    nullable=True)
    month             = Column(Integer,    nullable=True)
    day               = Column(Integer,    nullable=True)
    weekday           = Column(String(15), nullable=True)
    is_weekend        = Column(Boolean,    default=False)
    hour              = Column(Integer,    nullable=True)
    time_of_day       = Column(String(20), nullable=True)
    season            = Column(String(20), nullable=True)
    severity_score    = Column(Float,      default=0.0)
    severity_label    = Column(String(20), nullable=True)
    segment_500m      = Column(Float,      nullable=True, index=True)
    segment_1km       = Column(Integer,    nullable=True)

    # ── Relationship ─────────────────────────────────────────────
    upload = relationship("Upload", back_populates="accidents")

    def __repr__(self):
        return f"<Accident id={self.id} chainage={self.chainage_km}>"


# ════════════════════════════════════════════════════════════════
# 3. SEGMENTS — aggregated 500m segments (Stage 3 output)
# ════════════════════════════════════════════════════════════════
class Segment(Base):
    __tablename__ = "segments"

    id                  = Column(Integer, primary_key=True, index=True)
    upload_id           = Column(Integer, ForeignKey("uploads.id",
                                  ondelete="CASCADE"), nullable=False, index=True)

    # ── Segment identity ────────────────────────────────────────
    segment_500m        = Column(Float,   nullable=False, index=True)

    # ── Aggregated counts ────────────────────────────────────────
    total_accidents     = Column(Integer, default=0)
    total_fatal         = Column(Integer, default=0)
    total_grievous      = Column(Integer, default=0)
    total_minor         = Column(Integer, default=0)
    total_non_injured   = Column(Integer, default=0)
    total_severity      = Column(Float,   default=0.0)
    avg_severity        = Column(Float,   default=0.0)
    years_active        = Column(Integer, default=1)
    accident_rate       = Column(Float,   default=0.0)  # accidents / years_active

    # ── Dominant categorical values ──────────────────────────────
    dominant_nature     = Column(String(100), nullable=True)
    dominant_cause      = Column(String(200), nullable=True)
    dominant_vehicle    = Column(String(150), nullable=True)
    dominant_time       = Column(String(20),  nullable=True)
    locations           = Column(Text,         nullable=True)

    # ── Adaptive threshold values used ───────────────────────────
    accident_threshold  = Column(Float, nullable=True)
    severity_threshold  = Column(Float, nullable=True)
    fatal_threshold     = Column(Float, nullable=True)
    grievous_threshold  = Column(Float, nullable=True)
    rate_threshold      = Column(Float, nullable=True)

    # ── IRC / Adaptive criteria ──────────────────────────────────
    criteria_a          = Column(Boolean, default=False)  # High accident freq
    criteria_b          = Column(Boolean, default=False)  # High fatalities
    criteria_c          = Column(Boolean, default=False)  # High severity
    criteria_d          = Column(Boolean, default=False)  # High grievous
    criteria_e          = Column(Boolean, default=False)  # High accident rate
    criteria_count      = Column(Integer, default=0)

    # ── Classification ───────────────────────────────────────────
    is_blackspot        = Column(Boolean, default=False, index=True)
    is_watch_zone       = Column(Boolean, default=False)
    risk_tier           = Column(String(30), nullable=True)
    blackspot_rank_score= Column(Float, default=0.0)

    # ── DBSCAN cluster ───────────────────────────────────────────
    cluster_id          = Column(Integer, nullable=True)  # -1 = noise

    # ── Relationship ─────────────────────────────────────────────
    upload     = relationship("Upload",    back_populates="segments")
    blackspot  = relationship("Blackspot", back_populates="segment",
                               uselist=False, cascade="all, delete-orphan")

    def __repr__(self):
        return (f"<Segment km={self.segment_500m} "
                f"bs={self.is_blackspot} tier={self.risk_tier}>")


# ════════════════════════════════════════════════════════════════
# 4. BLACKSPOTS — filtered blackspot records (for fast API queries)
# ════════════════════════════════════════════════════════════════
class Blackspot(Base):
    __tablename__ = "blackspots"

    id                  = Column(Integer, primary_key=True, index=True)
    upload_id           = Column(Integer, ForeignKey("uploads.id",
                                  ondelete="CASCADE"), nullable=False, index=True)
    segment_id          = Column(Integer, ForeignKey("segments.id",
                                  ondelete="CASCADE"), nullable=False)

    # ── Key fields mirrored for fast reads ──────────────────────
    segment_500m        = Column(Float,   nullable=False, index=True)
    rank                = Column(Integer, nullable=True)
    total_accidents     = Column(Integer, default=0)
    total_fatal         = Column(Integer, default=0)
    total_grievous      = Column(Integer, default=0)
    total_severity      = Column(Float,   default=0.0)
    accident_rate       = Column(Float,   default=0.0)
    criteria_count      = Column(Integer, default=0)
    risk_tier           = Column(String(30), nullable=True)
    blackspot_rank_score= Column(Float,   default=0.0)
    dominant_cause      = Column(String(200), nullable=True)
    dominant_nature     = Column(String(100), nullable=True)
    dominant_vehicle    = Column(String(150), nullable=True)
    dominant_time       = Column(String(20),  nullable=True)
    locations           = Column(Text,    nullable=True)
    cluster_id          = Column(Integer, nullable=True)
    detected_at         = Column(DateTime(timezone=True), server_default=func.now())

    # ── Relationships ────────────────────────────────────────────
    upload  = relationship("Upload",  back_populates="blackspots")
    segment = relationship("Segment", back_populates="blackspot")

    def __repr__(self):
        return (f"<Blackspot km={self.segment_500m} "
                f"rank={self.rank} tier={self.risk_tier}>")
