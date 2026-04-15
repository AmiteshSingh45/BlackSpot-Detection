"""
app/routes/alerts.py
─────────────────────
Alert management endpoints.

Routes:
  GET  /api/v1/alerts                    — List alerts (filterable, paginated)
  GET  /api/v1/alerts/{id}              — Single alert detail
  PATCH /api/v1/alerts/{id}/acknowledge — Mark alert as acknowledged
  DELETE /api/v1/alerts/{id}            — Remove a single alert
  GET  /api/v1/alerts/summary           — Unread count + tier breakdown
"""

from typing import Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import Alert
from app.schemas import AlertResponse, AlertListResponse, AlertSummary
from app.services.alert_service import acknowledge_alert

router = APIRouter(prefix="/alerts", tags=["Alerts"])


# ════════════════════════════════════════════════════════════════
# GET /alerts/summary  (must be declared before /{id})
# ════════════════════════════════════════════════════════════════

@router.get(
    "/summary",
    response_model=AlertSummary,
    summary="Alert summary — unread count and tier breakdown",
    description="Returns the total unacknowledged alert count and a breakdown by risk tier.",
)
def get_alert_summary(
    upload_id: Optional[int] = Query(None, description="Filter by upload ID"),
    db: Session = Depends(get_db),
):
    query = db.query(Alert)
    if upload_id is not None:
        query = query.filter(Alert.upload_id == upload_id)

    total_unread = query.filter(Alert.acknowledged == False).count()  # noqa: E712
    total_all    = query.count()

    # Tier breakdown for unread alerts
    tier_rows = (
        query
        .filter(Alert.acknowledged == False)  # noqa: E712
        .with_entities(Alert.risk_tier, func.count(Alert.id))
        .group_by(Alert.risk_tier)
        .all()
    )
    tier_breakdown = {tier: count for tier, count in tier_rows}

    return AlertSummary(
        total_alerts    = total_all,
        unread_count    = total_unread,
        tier_breakdown  = tier_breakdown,
    )


# ════════════════════════════════════════════════════════════════
# GET /alerts — List
# ════════════════════════════════════════════════════════════════

@router.get(
    "",
    response_model=AlertListResponse,
    summary="List all alerts",
    description=(
        "Returns paginated alerts. Filter by upload_id, risk_tier, alert_type, "
        "or acknowledged status."
    ),
)
def list_alerts(
    upload_id:    Optional[int] = Query(None),
    risk_tier:    Optional[str] = Query(None, description="e.g. CRITICAL, HIGH"),
    alert_type:   Optional[str] = Query(None, description="e.g. HIGH_RISK"),
    acknowledged: Optional[bool] = Query(None, description="True = only acknowledged"),
    skip:  int = Query(0,   ge=0,   description="Pagination offset"),
    limit: int = Query(50,  ge=1,   le=500, description="Results per page"),
    db: Session = Depends(get_db),
):
    query = db.query(Alert)

    if upload_id is not None:
        query = query.filter(Alert.upload_id == upload_id)
    if risk_tier is not None:
        query = query.filter(Alert.risk_tier.ilike(f"%{risk_tier}%"))
    if alert_type is not None:
        query = query.filter(Alert.alert_type.ilike(f"%{alert_type}%"))
    if acknowledged is not None:
        query = query.filter(Alert.acknowledged == acknowledged)

    total = query.count()
    alerts = (
        query
        .order_by(Alert.triggered_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return AlertListResponse(total=total, alerts=alerts)


# ════════════════════════════════════════════════════════════════
# GET /alerts/{alert_id}
# ════════════════════════════════════════════════════════════════

@router.get(
    "/{alert_id}",
    response_model=AlertResponse,
    summary="Get a single alert by ID",
)
def get_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert with id={alert_id} not found",
        )
    return alert


# ════════════════════════════════════════════════════════════════
# PATCH /alerts/{alert_id}/acknowledge
# ════════════════════════════════════════════════════════════════

@router.patch(
    "/{alert_id}/acknowledge",
    response_model=AlertResponse,
    summary="Acknowledge an alert",
    description="Marks an alert as acknowledged, recording the timestamp.",
)
def patch_acknowledge(alert_id: int, db: Session = Depends(get_db)):
    alert = acknowledge_alert(db, alert_id)
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert with id={alert_id} not found",
        )
    return alert


# ════════════════════════════════════════════════════════════════
# DELETE /alerts/{alert_id}
# ════════════════════════════════════════════════════════════════

@router.delete(
    "/{alert_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an alert",
)
def delete_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert with id={alert_id} not found",
        )
    db.delete(alert)
    db.commit()
