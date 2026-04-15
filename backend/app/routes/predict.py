"""
app/routes/predict.py
──────────────────────
POST /api/v1/predict

Accepts a chainage km + optional time/weather context, looks up the
matching segment from the most recent (or specified) upload, and returns
a rich risk payload enriched with weather multiplier and recommendations.

This endpoint is designed to be called from the frontend map when a user
clicks a location, or from an external dispatch system to query real-time
risk before routing vehicles.
"""

from typing import Optional
import asyncio

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from loguru import logger

from app.database import get_db
from app.models import Blackspot, Segment, Upload
from app.schemas import PredictRequest, PredictResponse
from app.services.geocoding_service import chainage_to_latlng
from app.services.weather_service import get_current_weather
from app.services.recommendation_service import get_recommendations_for_blackspot

router = APIRouter(prefix="/predict", tags=["Predict"])


# ════════════════════════════════════════════════════════════════
# Helper — resolve latest upload
# ════════════════════════════════════════════════════════════════

def _resolve_upload_id(db: Session, upload_id: Optional[int]) -> int:
    if upload_id is not None:
        return upload_id
    latest: Optional[Upload] = (
        db.query(Upload)
        .filter(Upload.status == "completed")
        .order_by(Upload.pipeline_ended.desc())
        .first()
    )
    if not latest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No completed pipeline run found. Upload and process data first.",
        )
    return latest.id


# ════════════════════════════════════════════════════════════════
# POST /predict
# ════════════════════════════════════════════════════════════════

@router.post(
    "",
    response_model=PredictResponse,
    summary="Predict risk for a highway location",
    description=(
        "Given a chainage km value (and optionally hour + weather condition), "
        "returns the risk score, tier, weather-adjusted score, and action recommendations. "
        "Uses the latest completed pipeline run unless `upload_id` is specified."
    ),
)
async def predict_risk(
    payload: PredictRequest,
    db: Session = Depends(get_db),
):
    upload_id = _resolve_upload_id(db, payload.upload_id)

    # ── Find the matching 500m segment ──────────────────────────
    # segment_500m is stored as floor(chainage_km / 0.5) * 0.5
    seg_key = round(int(payload.chainage_km / 0.5) * 0.5, 1)

    # First check if it's a detected blackspot
    bs: Optional[Blackspot] = (
        db.query(Blackspot)
        .filter(
            Blackspot.upload_id == upload_id,
            Blackspot.segment_500m == seg_key,
        )
        .first()
    )

    # Fall back to segment table (covers non-blackspot segments)
    seg: Optional[Segment] = (
        db.query(Segment)
        .filter(
            Segment.upload_id == upload_id,
            Segment.segment_500m == seg_key,
        )
        .first()
    )

    if not seg and not bs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                f"No segment found at chainage km {payload.chainage_km} "
                f"(segment key {seg_key}) for upload_id={upload_id}."
            ),
        )

    # Use blackspot data if available, otherwise segment
    source = bs or seg
    risk_score  = float(source.blackspot_rank_score or 0.0)
    risk_tier   = source.risk_tier or "SAFE"
    is_blackspot = bool(bs is not None)

    # ── Geocode ─────────────────────────────────────────────────
    lat, lng = chainage_to_latlng(payload.chainage_km)

    # ── Weather enrichment ─────────────────────────────────────
    weather_data = await get_current_weather(lat, lng)
    weather_condition = payload.weather_condition or weather_data.get("condition", "Unknown")
    multiplier = weather_data.get("risk_multiplier", 1.0)
    adjusted_score = round(risk_score * multiplier, 2)

    # ── Recommendations ─────────────────────────────────────────
    rec_list: list[dict] = []
    if bs:
        recs = get_recommendations_for_blackspot(db, bs.id)
        rec_list = [
            {
                "priority":  r.priority,
                "category":  r.category,
                "action":    r.action,
                "rationale": r.rationale,
            }
            for r in recs[:10]   # cap at 10 in this response
        ]

    alert_triggered = (
        risk_score >= 70.0
        or risk_tier in ("CRITICAL", "HIGH")
    )

    logger.info(
        f"Predict: km={payload.chainage_km} tier={risk_tier} "
        f"score={risk_score} adjusted={adjusted_score} "
        f"weather={weather_condition}"
    )

    return PredictResponse(
        chainage_km         = payload.chainage_km,
        segment_500m        = seg_key,
        latitude            = lat,
        longitude           = lng,
        risk_score          = risk_score,
        risk_tier           = risk_tier,
        is_blackspot        = is_blackspot,
        total_accidents     = source.total_accidents or 0,
        total_fatal         = source.total_fatal or 0,
        dominant_cause      = source.dominant_cause,
        dominant_time       = source.dominant_time,
        weather_condition   = weather_condition,
        weather_multiplier  = multiplier,
        adjusted_risk_score = adjusted_score,
        recommendations     = rec_list,
        alert_triggered     = alert_triggered,
    )
