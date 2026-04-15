"""
src/pipeline.py
────────────────
Master orchestrator — runs all 5 stages sequentially and persists
results to the PostgreSQL database.

Call: run_pipeline(file_path, upload_id, db)

Flow:
  Stage 1 — Data Ingestion (load + audit)
  Stage 2 — Preprocessing (clean + feature engineering)
  Stage 3 — Segmentation (500m aggregation)
  Stage 4 — Blackspot Detection (adaptive criteria + DBSCAN)
  Stage 5 — Persist to DB (accidents, segments, blackspots tables)
"""

import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
from loguru import logger
from sqlalchemy.orm import Session

from app.models import Upload, Accident, Segment, Blackspot
from src.data_ingestion import load_file, audit_data
from src.preprocessing import preprocess
from src.segmentation import aggregate_segments
from src.blackspot_detection import detect_blackspots, get_blackspots_df


# ════════════════════════════════════════════════════════════════
# HELPERS — Convert DataFrame rows to ORM objects
# ════════════════════════════════════════════════════════════════

def _nan_to_none(val):
    """Convert numpy NaN / inf to Python None for DB safety."""
    if val is None:
        return None
    try:
        if np.isnan(val) or np.isinf(val):
            return None
    except (TypeError, ValueError):
        pass
    return val


def _safe_int(val) -> Optional[int]:
    v = _nan_to_none(val)
    return int(v) if v is not None else None


def _safe_float(val) -> Optional[float]:
    v = _nan_to_none(val)
    return float(v) if v is not None else None


def _safe_bool(val) -> bool:
    if pd.isna(val):
        return False
    return bool(val)


def _safe_str(val) -> Optional[str]:
    if val is None or (isinstance(val, float) and np.isnan(val)):
        return None
    s = str(val).strip()
    return s if s else None


# ════════════════════════════════════════════════════════════════
# PERSIST ACCIDENTS
# ════════════════════════════════════════════════════════════════

def _persist_accidents(df: pd.DataFrame, upload_id: int, db: Session):
    """
    Bulk-insert all accident records into the accidents table.
    """
    logger.info(f"Persisting {len(df)} accident records...")

    accident_objs = []
    for _, row in df.iterrows():
        obj = Accident(
            upload_id         = upload_id,
            sr_no             = _safe_int(row.get("sr_no")),
            date              = row.get("date") if not pd.isnull(row.get("date", pd.NaT)) else None,
            time              = _safe_str(row.get("time")),
            location_chainage = _safe_str(row.get("location_chainage")),
            accident_location = _safe_str(row.get("accident_location")),
            nature            = _safe_str(row.get("nature")),
            classification    = _safe_str(row.get("classification")),
            causes            = _safe_str(row.get("causes")),
            road_features     = _safe_str(row.get("road_features")),
            road_condition    = _safe_str(row.get("road_condition")),
            intersection      = _safe_str(row.get("intersection")),
            weather           = _safe_str(row.get("weather")),
            vehicle_type      = _safe_str(row.get("vehicle_type")),
            fatal             = _safe_int(row.get("fatal")) or 0,
            grievous          = _safe_int(row.get("grievous")) or 0,
            minor             = _safe_int(row.get("minor")) or 0,
            non_injured       = _safe_int(row.get("non_injured")) or 0,
            source_file       = _safe_str(row.get("source_file")),
            # Engineered features
            chainage_km       = _safe_float(row.get("chainage_km")),
            year              = _safe_int(row.get("year")),
            month             = _safe_int(row.get("month")),
            day               = _safe_int(row.get("day")),
            weekday           = _safe_str(row.get("weekday")),
            is_weekend        = _safe_bool(row.get("is_weekend")),
            hour              = _safe_int(row.get("hour")),
            time_of_day       = _safe_str(row.get("time_of_day")),
            season            = _safe_str(row.get("season")),
            severity_score    = _safe_float(row.get("severity_score")) or 0.0,
            severity_label    = _safe_str(row.get("severity_label")),
            segment_500m      = _safe_float(row.get("segment_500m")),
            segment_1km       = _safe_int(row.get("segment_1km")),
        )
        accident_objs.append(obj)

    db.bulk_save_objects(accident_objs)
    db.flush()
    logger.success(f"Persisted {len(accident_objs)} accident records")


# ════════════════════════════════════════════════════════════════
# PERSIST SEGMENTS
# ════════════════════════════════════════════════════════════════

def _persist_segments(segment_df: pd.DataFrame,
                       upload_id: int,
                       db: Session) -> dict:
    """
    Insert segment records and return a mapping:
    { segment_500m: segment.id } for use when inserting blackspots.
    """
    logger.info(f"Persisting {len(segment_df)} segments...")

    segment_id_map = {}  # segment_500m → DB id

    for _, row in segment_df.iterrows():
        obj = Segment(
            upload_id           = upload_id,
            segment_500m        = _safe_float(row["segment_500m"]),
            total_accidents     = _safe_int(row.get("total_accidents")) or 0,
            total_fatal         = _safe_int(row.get("total_fatal")) or 0,
            total_grievous      = _safe_int(row.get("total_grievous")) or 0,
            total_minor         = _safe_int(row.get("total_minor")) or 0,
            total_non_injured   = _safe_int(row.get("total_non_injured")) or 0,
            total_severity      = _safe_float(row.get("total_severity")) or 0.0,
            avg_severity        = _safe_float(row.get("avg_severity")) or 0.0,
            years_active        = _safe_int(row.get("years_active")) or 1,
            accident_rate       = _safe_float(row.get("accident_rate")) or 0.0,
            dominant_nature     = _safe_str(row.get("dominant_nature")),
            dominant_cause      = _safe_str(row.get("dominant_cause")),
            dominant_vehicle    = _safe_str(row.get("dominant_vehicle")),
            dominant_time       = _safe_str(row.get("dominant_time")),
            locations           = _safe_str(row.get("locations")),
            accident_threshold  = _safe_float(row.get("accident_threshold")),
            severity_threshold  = _safe_float(row.get("severity_threshold")),
            fatal_threshold     = _safe_float(row.get("fatal_threshold")),
            grievous_threshold  = _safe_float(row.get("grievous_threshold")),
            rate_threshold      = _safe_float(row.get("rate_threshold")),
            criteria_a          = _safe_bool(row.get("criteria_a")),
            criteria_b          = _safe_bool(row.get("criteria_b")),
            criteria_c          = _safe_bool(row.get("criteria_c")),
            criteria_d          = _safe_bool(row.get("criteria_d")),
            criteria_e          = _safe_bool(row.get("criteria_e")),
            criteria_count      = _safe_int(row.get("criteria_count")) or 0,
            is_blackspot        = _safe_bool(row.get("is_blackspot")),
            is_watch_zone       = _safe_bool(row.get("is_watch_zone")),
            risk_tier           = _safe_str(row.get("risk_tier")),
            blackspot_rank_score= _safe_float(row.get("blackspot_rank_score")) or 0.0,
            cluster_id          = _safe_int(row.get("cluster_id")),
        )
        db.add(obj)
        db.flush()  # flush to get the assigned id
        segment_id_map[row["segment_500m"]] = obj.id

    logger.success(f"Persisted {len(segment_id_map)} segments")
    return segment_id_map


# ════════════════════════════════════════════════════════════════
# PERSIST BLACKSPOTS
# ════════════════════════════════════════════════════════════════

def _persist_blackspots(blackspots_df: pd.DataFrame,
                         upload_id: int,
                         segment_id_map: dict,
                         db: Session):
    """
    Insert blackspot records using the segment_id_map for FK linkage.
    """
    logger.info(f"Persisting {len(blackspots_df)} blackspots...")

    bs_objs = []
    for _, row in blackspots_df.iterrows():
        seg_km    = row["segment_500m"]
        segment_id = segment_id_map.get(seg_km)
        if segment_id is None:
            logger.warning(f"No segment_id for segment_500m={seg_km} — skipping")
            continue

        obj = Blackspot(
            upload_id           = upload_id,
            segment_id          = segment_id,
            segment_500m        = _safe_float(seg_km),
            rank                = _safe_int(row.get("rank")),
            total_accidents     = _safe_int(row.get("total_accidents")) or 0,
            total_fatal         = _safe_int(row.get("total_fatal")) or 0,
            total_grievous      = _safe_int(row.get("total_grievous")) or 0,
            total_severity      = _safe_float(row.get("total_severity")) or 0.0,
            accident_rate       = _safe_float(row.get("accident_rate")) or 0.0,
            criteria_count      = _safe_int(row.get("criteria_count")) or 0,
            risk_tier           = _safe_str(row.get("risk_tier")),
            blackspot_rank_score= _safe_float(row.get("blackspot_rank_score")) or 0.0,
            dominant_cause      = _safe_str(row.get("dominant_cause")),
            dominant_nature     = _safe_str(row.get("dominant_nature")),
            dominant_vehicle    = _safe_str(row.get("dominant_vehicle")),
            dominant_time       = _safe_str(row.get("dominant_time")),
            locations           = _safe_str(row.get("locations")),
            cluster_id          = _safe_int(row.get("cluster_id")),
            confidence_score    = _safe_float(row.get("confidence_score")),
        )
        bs_objs.append(obj)

    db.bulk_save_objects(bs_objs)
    db.flush()
    logger.success(f"Persisted {len(bs_objs)} blackspots")


# ════════════════════════════════════════════════════════════════
# MASTER PIPELINE
# ════════════════════════════════════════════════════════════════

def run_pipeline(file_path: str, upload_id: int, db: Session) -> dict:
    """
    Full 5-stage pipeline orchestrator.

    Args:
        file_path:  Absolute path to the uploaded file
        upload_id:  The Upload.id row in the database
        db:         SQLAlchemy database session

    Returns:
        Summary dict with counts and duration.
    """
    start_time = time.time()
    logger.info(f"{'='*60}")
    logger.info(f"PIPELINE START — upload_id={upload_id}, file={file_path}")
    logger.info(f"{'='*60}")

    # Update upload status to 'processing'
    upload = db.get(Upload, upload_id)
    if not upload:
        raise ValueError(f"Upload with id={upload_id} not found")

    upload.status           = "processing"
    upload.pipeline_started = datetime.now(timezone.utc)
    db.commit()

    try:
        # ── STAGE 1: Data Ingestion ──────────────────────────────
        logger.info("▶ Stage 1: Loading data...")
        df = load_file(file_path)

        # Validate required columns exist after canonicalization
        from src.data_ingestion import validate_required_columns
        validation = validate_required_columns(df)
        if not validation["valid"]:
            missing = validation["missing"]
            all_cols = validation["all_columns"]
            raise ValueError(
                f"Required columns missing: {missing}. "
                f"Columns found in file: {all_cols}"
            )

        audit = audit_data(df)
        record_count = len(df)

        # ── STAGE 2: Preprocessing + Feature Engineering ─────────
        logger.info("▶ Stage 2: Preprocessing...")
        df = preprocess(df)

        # ── STAGE 3: 500m Segmentation ───────────────────────────
        logger.info("▶ Stage 3: Segmentation...")
        segment_df = aggregate_segments(df)

        # ── STAGE 4: Blackspot Detection ─────────────────────────────
        logger.info("▶ Stage 4: Blackspot Detection...")

        # Fetch prior blackspot km values from OTHER uploads for consistency scoring
        prior_blackspot_kms: set[float] = set(
            km for (km,) in
            db.query(Blackspot.segment_500m)
            .filter(Blackspot.upload_id != upload_id)
            .distinct()
            .all()
        )
        logger.info(f"Prior blackspot reference KMs loaded: {len(prior_blackspot_kms)}")

        segment_df = detect_blackspots(segment_df, prior_blackspot_kms=prior_blackspot_kms)
        blackspots_df = get_blackspots_df(segment_df)

        n_segments   = len(segment_df)
        n_blackspots = len(blackspots_df)
        n_watch      = int(segment_df["is_watch_zone"].sum())

        # ── STAGE 5: Persist to Database ─────────────────────────
        logger.info("▶ Stage 5: Persisting to database...")

        # Clear any previous data for this upload (re-run safety)
        db.query(Accident).filter(Accident.upload_id == upload_id).delete()
        db.query(Blackspot).filter(Blackspot.upload_id == upload_id).delete()
        db.query(Segment).filter(Segment.upload_id == upload_id).delete()
        db.flush()

        _persist_accidents(df, upload_id, db)
        segment_id_map = _persist_segments(segment_df, upload_id, db)
        _persist_blackspots(blackspots_df, upload_id, segment_id_map, db)

        # Update upload record
        duration = round(time.time() - start_time, 2)
        upload.status          = "completed"
        upload.pipeline_ended  = datetime.now(timezone.utc)
        upload.record_count    = record_count
        upload.blackspot_count = n_blackspots
        upload.segment_count   = n_segments
        db.commit()

        # ── POST-PIPELINE: Alerts + Recommendations ─────────────────────────
        # These run after the core pipeline is committed. Wrapped in
        # try/except so failures here never corrupt the main data.
        try:
            from app.services.alert_service import generate_alerts
            alerts_generated = generate_alerts(db, upload_id)
            logger.info(f"Post-pipeline: {len(alerts_generated)} alerts generated")
        except Exception as ae:
            logger.error(f"Alert generation failed (non-fatal): {ae}")

        try:
            from app.services.recommendation_service import generate_recommendations
            rec_count = generate_recommendations(db, upload_id)
            logger.info(f"Post-pipeline: {rec_count} recommendations generated")
        except Exception as re:
            logger.error(f"Recommendation generation failed (non-fatal): {re}")

        summary = {
            "upload_id":       upload_id,
            "status":          "completed",
            "message":         "Pipeline completed successfully",
            "record_count":    record_count,
            "segment_count":   n_segments,
            "blackspot_count": n_blackspots,
            "watch_zone_count":n_watch,
            "duration_seconds":duration,
        }

        logger.success(
            f"PIPELINE COMPLETE — {record_count} records | "
            f"{n_segments} segments | "
            f"{n_blackspots} blackspots | "
            f"{duration}s"
        )
        return summary

    except Exception as e:
        # Mark upload as failed
        upload.status        = "failed"
        upload.pipeline_ended = datetime.now(timezone.utc)
        upload.error_message = str(e)
        db.commit()

        logger.error(f"PIPELINE FAILED — {e}")
        raise
