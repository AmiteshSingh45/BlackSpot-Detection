"""
app/services/alert_service.py
──────────────────────────────
Auto-generates Alert records immediately after the pipeline
persists blackspot data to the database.

Alert Types:
  HIGH_RISK        — CRITICAL/HIGH tier or score >= threshold
  NEW_BLACKSPOT    — km not found in any prior upload's blackspots
  RISK_UPGRADED    — same km had a lower risk tier in a previous upload
  CLUSTER_GROWN    — cluster at this km is larger than in prior run

Priority Score (0–100):
  tier_score     × 0.40   (CRITICAL=100, HIGH=75, MODERATE=50, else 25)
  confidence     × 0.35   (blackspot.confidence_score 0–100)
  fatality_score × 0.25   (min(total_fatal / 10, 1.0) × 100)

Idempotency:
  Existing alerts for this upload_id are deleted before generation
  so re-running the pipeline doesn't create duplicates.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from loguru import logger
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Blackspot, Alert
from app.services.geocoding_service import chainage_to_latlng


# ════════════════════════════════════════════════════════════════
# Tier priority order (highest first)
# ════════════════════════════════════════════════════════════════

_TIER_PRIORITY: dict[str, int] = {
    "CRITICAL":   5,
    "HIGH":       4,
    "MODERATE":   3,
    "BLACK SPOT": 2,
    "WATCH ZONE": 1,
    "SAFE":       0,
}

_TIER_SCORE: dict[str, float] = {
    "CRITICAL":   100.0,
    "HIGH":        75.0,
    "MODERATE":    50.0,
    "BLACK SPOT":  40.0,
    "WATCH ZONE":  25.0,
}


def _compute_priority_score(bs: Blackspot) -> float:
    """
    Compute priority score 0–100 for an alert.
    Formula: tier(40%) + confidence(35%) + fatalities(25%)
    Three independent signals — no correlation.
    """
    tier   = (bs.risk_tier or "").upper()
    t_score = _TIER_SCORE.get(tier, 25.0)

    confidence = bs.confidence_score or 0.0

    fatal_ratio = min((bs.total_fatal or 0) / 10.0, 1.0)
    f_score     = fatal_ratio * 100.0

    return round(t_score * 0.40 + confidence * 0.35 + f_score * 0.25, 1)


def _should_alert(bs: Blackspot, critical_tiers: set[str]) -> bool:
    """Return True if this blackspot should trigger a HIGH_RISK alert."""
    tier      = (bs.risk_tier or "").upper()
    score     = bs.blackspot_rank_score or 0.0
    c_count   = bs.criteria_count or 0
    threshold = settings.ALERT_RISK_THRESHOLD

    if tier in critical_tiers:
        return True
    if score >= threshold:
        return True
    if tier == "MODERATE" and c_count >= 3:
        return True
    return False


def _build_message(bs: Blackspot, alert_type: str = "HIGH_RISK",
                   old_tier: str | None = None,
                   cluster_prev_size: int | None = None) -> str:
    """Build a human-readable alert message."""
    if alert_type == "NEW_BLACKSPOT":
        return (
            f"New blackspot detected at km {bs.segment_500m} — "
            f"not present in previous datasets. "
            f"{bs.total_accidents} accidents, {bs.total_fatal} fatal. "
            f"Tier: {bs.risk_tier}"
        )
    if alert_type == "RISK_UPGRADED" and old_tier:
        return (
            f"Risk level at km {bs.segment_500m} escalated: "
            f"{old_tier} → {bs.risk_tier}. "
            f"{bs.total_accidents} accidents, {bs.total_fatal} fatal"
        )
    if alert_type == "CLUSTER_GROWN" and cluster_prev_size is not None:
        return (
            f"Blackspot cluster #{bs.cluster_id} at km {bs.segment_500m} has grown "
            f"({cluster_prev_size} → {cluster_prev_size + 1}+ locations). "
            f"Corridor-level intervention recommended"
        )
    # Default HIGH_RISK
    parts = [
        f"{bs.risk_tier or 'Unknown'} blackspot at km {bs.segment_500m}",
        f"{bs.total_accidents} accidents",
        f"{bs.total_fatal} fatal",
    ]
    if bs.dominant_cause:
        parts.append(f"main cause: {bs.dominant_cause}")
    if bs.dominant_time:
        parts.append(f"peak time: {bs.dominant_time}")
    return " — ".join(parts)


def _make_alert(
    bs: Blackspot,
    upload_id: int,
    lat: float,
    lng: float,
    alert_type: str,
    message: str,
) -> Alert:
    """Construct an Alert ORM object with priority_score populated."""
    return Alert(
        blackspot_id      = bs.id,
        upload_id         = upload_id,
        segment_500m      = bs.segment_500m,
        latitude          = lat,
        longitude         = lng,
        risk_tier         = bs.risk_tier or "UNKNOWN",
        risk_score        = bs.blackspot_rank_score or 0.0,
        alert_type        = alert_type,
        message           = message,
        weather_condition = None,
        acknowledged      = False,
        priority_score    = _compute_priority_score(bs),
    )


# ════════════════════════════════════════════════════════════════
# Public API
# ════════════════════════════════════════════════════════════════

def generate_alerts(db: Session, upload_id: int) -> list[Alert]:
    """
    Generate and persist Alert records for an upload.

    Called at the end of `run_pipeline()` after blackspot persistence.

    Generates up to 4 alert types per blackspot:
      HIGH_RISK     — standard risk threshold trigger
      NEW_BLACKSPOT — km not seen in prior uploads
      RISK_UPGRADED — tier is higher than in prior uploads
      CLUSTER_GROWN — cluster is larger than in prior run

    Args:
        db:         SQLAlchemy session.
        upload_id:  The Upload.id whose blackspots to evaluate.

    Returns:
        List of Alert ORM objects that were committed.
    """
    logger.info(f"Generating alerts for upload_id={upload_id}…")

    critical_tiers: set[str] = {
        t.strip().upper()
        for t in settings.ALERT_CRITICAL_TIERS.split(",")
        if t.strip()
    }

    # Idempotency: remove any alerts from a previous run for this upload
    existing = db.query(Alert).filter(Alert.upload_id == upload_id).count()
    if existing:
        db.query(Alert).filter(Alert.upload_id == upload_id).delete()
        db.flush()
        logger.info(f"Removed {existing} stale alerts for upload_id={upload_id}")

    # ── Load prior blackspot data for comparison ──────────────────
    # { segment_500m → risk_tier } from all other uploads
    prior_bs_rows = (
        db.query(Blackspot.segment_500m, Blackspot.risk_tier, Blackspot.cluster_id)
        .filter(Blackspot.upload_id != upload_id)
        .all()
    )
    prior_km_to_tier: dict[float, str] = {}
    prior_cluster_sizes: dict[int, int] = {}

    for row in prior_bs_rows:
        km   = row.segment_500m
        tier = (row.risk_tier or "SAFE").upper()
        cid  = row.cluster_id
        # Keep highest tier seen at this km across prior uploads
        if km not in prior_km_to_tier or (
            _TIER_PRIORITY.get(tier, 0) > _TIER_PRIORITY.get(prior_km_to_tier[km], 0)
        ):
            prior_km_to_tier[km] = tier
        if cid is not None and cid >= 0:
            prior_cluster_sizes[cid] = prior_cluster_sizes.get(cid, 0) + 1

    # ── Count current cluster sizes ────────────────────────────────
    current_cluster_rows = (
        db.query(Blackspot.cluster_id)
        .filter(Blackspot.upload_id == upload_id, Blackspot.cluster_id >= 0)
        .all()
    )
    current_cluster_sizes: dict[int, int] = {}
    for (cid,) in current_cluster_rows:
        current_cluster_sizes[cid] = current_cluster_sizes.get(cid, 0) + 1

    # ── Fetch all blackspots for this upload ──────────────────────
    blackspots: list[Blackspot] = (
        db.query(Blackspot)
        .filter(Blackspot.upload_id == upload_id)
        .order_by(Blackspot.blackspot_rank_score.desc())
        .all()
    )

    alerts_created: list[Alert] = []

    for bs in blackspots:
        lat, lng = chainage_to_latlng(bs.segment_500m)
        km       = bs.segment_500m
        tier     = (bs.risk_tier or "SAFE").upper()

        # ── 1. HIGH_RISK (existing behaviour) ─────────────────────
        if _should_alert(bs, critical_tiers):
            alerts_created.append(_make_alert(
                bs, upload_id, lat, lng,
                alert_type="HIGH_RISK",
                message=_build_message(bs, "HIGH_RISK"),
            ))

        # ── 2. NEW_BLACKSPOT ──────────────────────────────────────
        # km is "new" if no prior upload had a blackspot within ±0.3 km
        is_new = not any(abs(p_km - km) <= 0.3 for p_km in prior_km_to_tier)
        if is_new and tier not in ("SAFE", "WATCH ZONE"):
            alerts_created.append(_make_alert(
                bs, upload_id, lat, lng,
                alert_type="NEW_BLACKSPOT",
                message=_build_message(bs, "NEW_BLACKSPOT"),
            ))

        # ── 3. RISK_UPGRADED ─────────────────────────────────────
        # Check closest prior km (within ±0.3 km)
        closest_prior_tier = None
        for p_km, p_tier in prior_km_to_tier.items():
            if abs(p_km - km) <= 0.3:
                if closest_prior_tier is None or (
                    _TIER_PRIORITY.get(p_tier, 0) > _TIER_PRIORITY.get(closest_prior_tier, 0)
                ):
                    closest_prior_tier = p_tier
        if (
            closest_prior_tier
            and _TIER_PRIORITY.get(tier, 0) > _TIER_PRIORITY.get(closest_prior_tier, 0)
        ):
            alerts_created.append(_make_alert(
                bs, upload_id, lat, lng,
                alert_type="RISK_UPGRADED",
                message=_build_message(bs, "RISK_UPGRADED", old_tier=closest_prior_tier),
            ))

        # ── 4. CLUSTER_GROWN ──────────────────────────────────────
        cid = bs.cluster_id
        if cid is not None and cid >= 0:
            prev_size = prior_cluster_sizes.get(cid, 0)
            curr_size = current_cluster_sizes.get(cid, 0)
            if curr_size > prev_size and prev_size > 0:
                alerts_created.append(_make_alert(
                    bs, upload_id, lat, lng,
                    alert_type="CLUSTER_GROWN",
                    message=_build_message(bs, "CLUSTER_GROWN", cluster_prev_size=prev_size),
                ))

    db.bulk_save_objects(alerts_created)
    db.flush()
    db.commit()

    type_breakdown = {}
    for a in alerts_created:
        type_breakdown[a.alert_type] = type_breakdown.get(a.alert_type, 0) + 1

    logger.success(
        f"Generated {len(alerts_created)} alerts for upload_id={upload_id} "
        f"| breakdown: {type_breakdown}"
    )
    return alerts_created


def acknowledge_alert(db: Session, alert_id: int) -> Optional[Alert]:
    """Mark a single alert as acknowledged."""
    alert = db.get(Alert, alert_id)
    if not alert:
        return None
    alert.acknowledged    = True
    alert.acknowledged_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(alert)
    logger.info(f"Alert {alert_id} acknowledged")
    return alert
