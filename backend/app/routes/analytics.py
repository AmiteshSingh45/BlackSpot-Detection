"""
app/routes/analytics.py
────────────────────────
Analytics & dashboard endpoints.

Mirrors Stage 5 (Executive Summary + Yearly Trend) of the notebook.

Routes:
  GET /stats                   — KPI dashboard summary
  GET /analytics/monthly       — Monthly accident trend
  GET /analytics/yearly        — Year-on-year trend
  GET /analytics/severity      — Severity label distribution
  GET /analytics/causes        — Top causes breakdown
  GET /analytics/time-of-day   — Accidents by time of day
  GET /analytics/top-blackspots— Top N blackspots ranked
"""

from collections import Counter
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, case
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Accident, Blackspot, Segment, Upload
from app.schemas import (
    DashboardStats, YearlyTrend, CategoryCount, MonthlyTrend
)

router = APIRouter(prefix="/analytics", tags=["Analytics"])

MONTH_NAMES = {
    1: "Jan", 2: "Feb",  3: "Mar",  4: "Apr",
    5: "May", 6: "Jun",  7: "Jul",  8: "Aug",
    9: "Sep", 10: "Oct", 11: "Nov", 12: "Dec",
}


def _require_upload(upload_id: Optional[int], db: Session) -> Optional[int]:
    """If upload_id provided, validate it exists. Returns upload_id."""
    if upload_id is not None:
        if not db.get(Upload, upload_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Upload with id={upload_id} not found",
            )
    return upload_id


# ════════════════════════════════════════════════════════════════
# GET /analytics/stats  — Executive Dashboard KPIs
# ════════════════════════════════════════════════════════════════

@router.get(
    "/stats",
    response_model=DashboardStats,
    summary="Dashboard KPI summary",
    description=(
        "Returns top-level KPIs for the dashboard — mirrors the "
        "Stage 5 Executive Summary from the notebook. "
        "Filter by upload_id to get stats for a specific dataset."
    ),
)
def get_stats(
    upload_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    uid = _require_upload(upload_id, db)

    acc_q = db.query(Accident)
    bs_q  = db.query(Blackspot)
    seg_q = db.query(Segment)

    if uid:
        acc_q = acc_q.filter(Accident.upload_id == uid)
        bs_q  = bs_q.filter(Blackspot.upload_id == uid)
        seg_q = seg_q.filter(Segment.upload_id == uid)

    # ── Accident-level totals ────────────────────────────────────
    totals = acc_q.with_entities(
        func.count(Accident.id).label("total_accidents"),
        func.sum(Accident.fatal).label("total_fatal"),
        func.sum(Accident.grievous).label("total_grievous"),
        func.sum(Accident.minor).label("total_minor"),
        func.min(Accident.chainage_km).label("min_km"),
        func.max(Accident.chainage_km).label("max_km"),
        func.min(Accident.year).label("year_start"),
        func.max(Accident.year).label("year_end"),
    ).first()

    total_accidents  = totals.total_accidents or 0
    total_fatal      = int(totals.total_fatal or 0)
    total_grievous   = int(totals.total_grievous or 0)
    total_minor      = int(totals.total_minor or 0)
    total_casualties = total_fatal + total_grievous + total_minor
    highway_km_range = (
        round(totals.max_km - totals.min_km, 1)
        if totals.max_km and totals.min_km else None
    )

    # ── Blackspot-level totals ────────────────────────────────────
    bs_totals = bs_q.with_entities(
        func.count(Blackspot.id).label("n_blackspots"),
        func.sum(Blackspot.total_accidents).label("bs_accidents"),
        func.sum(Blackspot.total_fatal).label("bs_fatal"),
    ).first()

    n_blackspots       = bs_totals.n_blackspots or 0
    bs_accidents       = int(bs_totals.bs_accidents or 0)
    bs_fatal           = int(bs_totals.bs_fatal or 0)
    bs_pct             = round(bs_accidents / total_accidents * 100, 1) \
                         if total_accidents else 0.0
    n_watch_zones      = seg_q.filter(Segment.is_watch_zone == True).count()

    # ── Peak year ─────────────────────────────────────────────────
    peak = (
        acc_q.with_entities(
            Accident.year, func.count(Accident.id).label("cnt")
        )
        .filter(Accident.year.isnot(None))
        .group_by(Accident.year)
        .order_by(func.count(Accident.id).desc())
        .first()
    )
    peak_year = int(peak.year) if peak else None

    # ── Top segment ───────────────────────────────────────────────
    top_seg = bs_q.order_by(Blackspot.rank.asc().nulls_last()).first()
    highest_risk_segment_km = top_seg.segment_500m if top_seg else None

    # ── Top categorical values from ALL accidents ────────────────
    # (Accident model has no is_blackspot col — query all accidents)
    def top_from_acc(col_attr):
        q = acc_q.with_entities(col_attr, func.count().label("c"))
        q = q.filter(col_attr.isnot(None), col_attr != "Unknown")
        q = q.group_by(col_attr).order_by(func.count().desc())
        row = q.first()
        return row[0] if row else None

    return DashboardStats(
        total_accidents           = total_accidents,
        total_blackspots          = n_blackspots,
        total_watch_zones         = n_watch_zones,
        total_fatalities          = total_fatal,
        total_grievous            = total_grievous,
        total_minor               = total_minor,
        total_casualties          = total_casualties,
        accidents_in_blackspots   = bs_accidents,
        blackspot_accident_pct    = bs_pct,
        fatalities_in_blackspots  = bs_fatal,
        highway_km_range          = highway_km_range,
        analysis_year_start       = int(totals.year_start) if totals.year_start else None,
        analysis_year_end         = int(totals.year_end) if totals.year_end else None,
        peak_year                 = peak_year,
        highest_risk_segment_km   = highest_risk_segment_km,
        top_cause                 = top_from_acc(Accident.causes),
        top_nature                = top_from_acc(Accident.nature),
        top_vehicle               = top_from_acc(Accident.vehicle_type),
        top_time                  = top_from_acc(Accident.time_of_day),
        top_season                = top_from_acc(Accident.season),
    )


# ════════════════════════════════════════════════════════════════
# GET /analytics/yearly  — Year-on-year trend
# ════════════════════════════════════════════════════════════════

@router.get(
    "/yearly",
    summary="Year-on-year accident trend",
    description="Mirrors Stage 5.2 yearly trend analysis from the notebook.",
)
def get_yearly_trend(
    upload_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    uid = _require_upload(upload_id, db)
    query = (
        db.query(
            Accident.year,
            func.count(Accident.id).label("accidents"),
            func.sum(Accident.fatal).label("fatal"),
            func.sum(Accident.grievous).label("grievous"),
            func.sum(Accident.minor).label("minor"),
            func.sum(Accident.severity_score).label("severity"),
        )
        .filter(Accident.year.isnot(None))
        .filter(Accident.year > 1900)
    )
    if uid:
        query = query.filter(Accident.upload_id == uid)

    rows = query.group_by(Accident.year).order_by(Accident.year).all()

    result = []
    for row in rows:
        accidents = row.accidents or 0
        fatal     = int(row.fatal or 0)
        severity  = float(row.severity or 0)
        result.append({
            "year":                   int(row.year),
            "accidents":              accidents,
            "fatal":                  fatal,
            "grievous":               int(row.grievous or 0),
            "minor":                  int(row.minor or 0),
            "severity":               round(severity, 2),
            "fatality_rate":          round(fatal / accidents * 100, 2) if accidents else 0,
            "severity_per_accident":  round(severity / accidents, 2) if accidents else 0,
        })
    return {"yearly_trend": result, "total_years": len(result)}


# ════════════════════════════════════════════════════════════════
# GET /analytics/monthly  — Monthly trend
# ════════════════════════════════════════════════════════════════

@router.get(
    "/monthly",
    summary="Monthly accident trend",
)
def get_monthly_trend(
    upload_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    uid = _require_upload(upload_id, db)
    query = (
        db.query(
            Accident.month,
            func.count(Accident.id).label("accidents"),
        )
        .filter(Accident.month.isnot(None))
    )
    if uid:
        query = query.filter(Accident.upload_id == uid)

    rows = query.group_by(Accident.month).order_by(Accident.month).all()

    result = [
        {
            "month":      int(row.month),
            "month_name": MONTH_NAMES.get(int(row.month), "?"),
            "accidents":  row.accidents,
        }
        for row in rows
    ]
    return {"monthly_trend": result}


# ════════════════════════════════════════════════════════════════
# GET /analytics/severity  — Severity distribution
# ════════════════════════════════════════════════════════════════

@router.get("/severity", summary="Severity label distribution")
def get_severity_distribution(
    upload_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    uid = _require_upload(upload_id, db)
    query = (
        db.query(
            Accident.severity_label,
            func.count(Accident.id).label("count"),
        )
        .filter(Accident.severity_label.isnot(None))
    )
    if uid:
        query = query.filter(Accident.upload_id == uid)

    rows  = query.group_by(Accident.severity_label).all()
    total = sum(r.count for r in rows)

    order = ["No Casualty", "Low", "Medium", "High", "Critical"]
    row_map = {r.severity_label: r.count for r in rows}

    result = [
        {
            "label":      label,
            "count":      row_map.get(label, 0),
            "percentage": round(row_map.get(label, 0) / total * 100, 1) if total else 0,
        }
        for label in order if label in row_map
    ]
    return {"severity_distribution": result, "total_accidents": total}


# ════════════════════════════════════════════════════════════════
# GET /analytics/causes  — Top causes
# ════════════════════════════════════════════════════════════════

@router.get("/causes", summary="Top accident causes")
def get_causes(
    upload_id:   Optional[int] = Query(None),
    top_n:       int           = Query(10, ge=1, le=50),
    blackspot_only: bool       = Query(False),
    db: Session = Depends(get_db),
):
    uid = _require_upload(upload_id, db)
    query = (
        db.query(Accident.causes, func.count(Accident.id).label("count"))
        .filter(Accident.causes.isnot(None))
        .filter(Accident.causes != "Unknown")
    )
    if uid:
        query = query.filter(Accident.upload_id == uid)
    if blackspot_only:
        # Join to segments to filter blackspot accidents
        query = query.join(
            Segment,
            (Accident.segment_500m == Segment.segment_500m) &
            (Accident.upload_id == Segment.upload_id),
            isouter=False,
        ).filter(Segment.is_blackspot == True)  # noqa

    rows  = query.group_by(Accident.causes).order_by(func.count(Accident.id).desc()).limit(top_n).all()
    total = sum(r.count for r in rows)

    result = [
        {
            "label":      r.causes,
            "count":      r.count,
            "percentage": round(r.count / total * 100, 1) if total else 0,
        }
        for r in rows
    ]
    return {"top_causes": result, "total": total}


# ════════════════════════════════════════════════════════════════
# GET /analytics/time-of-day  — Time of day distribution
# ════════════════════════════════════════════════════════════════

@router.get("/time-of-day", summary="Accidents by time of day")
def get_time_of_day(
    upload_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    uid = _require_upload(upload_id, db)
    query = (
        db.query(Accident.time_of_day, func.count(Accident.id).label("count"))
        .filter(Accident.time_of_day.isnot(None))
    )
    if uid:
        query = query.filter(Accident.upload_id == uid)

    rows  = query.group_by(Accident.time_of_day).all()
    total = sum(r.count for r in rows)

    order = ["Morning", "Afternoon", "Evening", "Night", "Late Night", "Unknown"]
    row_map = {r.time_of_day: r.count for r in rows}

    result = [
        {
            "label":      t,
            "count":      row_map.get(t, 0),
            "percentage": round(row_map.get(t, 0) / total * 100, 1) if total else 0,
        }
        for t in order if t in row_map
    ]
    return {"time_of_day": result, "total": total}


# ════════════════════════════════════════════════════════════════
# GET /analytics/top-blackspots  — Top N ranked blackspots
# ════════════════════════════════════════════════════════════════

@router.get(
    "/top-blackspots",
    summary="Top N blackspots by rank score",
    description=(
        "Returns the top N blackspots ranked by composite score. "
        "Mirrors the 'TOP 15 BLACK SPOTS — RANKED' table from the notebook."
    ),
)
def get_top_blackspots(
    upload_id: Optional[int] = Query(None),
    top_n:     int           = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    uid = _require_upload(upload_id, db)
    query = db.query(Blackspot)
    if uid:
        query = query.filter(Blackspot.upload_id == uid)

    blackspots = (
        query
        .order_by(Blackspot.rank.asc().nulls_last())
        .limit(top_n)
        .all()
    )

    result = [
        {
            "rank":               bs.rank,
            "segment_km":         bs.segment_500m,
            "risk_tier":          bs.risk_tier,
            "total_accidents":    bs.total_accidents,
            "total_fatal":        bs.total_fatal,
            "total_grievous":     bs.total_grievous,
            "total_severity":     bs.total_severity,
            "accident_rate":      bs.accident_rate,
            "criteria_count":     bs.criteria_count,
            "dominant_cause":     bs.dominant_cause,
            "dominant_nature":    bs.dominant_nature,
            "dominant_time":      bs.dominant_time,
            "cluster_id":         bs.cluster_id,
            "blackspot_rank_score": bs.blackspot_rank_score,
            "locations":          bs.locations,
        }
        for bs in blackspots
    ]
    return {"top_blackspots": result, "count": len(result)}
