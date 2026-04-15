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
    DashboardStats, YearlyTrend, CategoryCount, MonthlyTrend,
    InsightItem, PersistentBlackspot, DataFreshness,
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


# ════════════════════════════════════════════════════════════════
# GET /analytics/insights  — Auto-generated plain-language insight strings
# ════════════════════════════════════════════════════════════════

@router.get(
    "/insights",
    response_model=list[InsightItem],
    summary="Auto-generated decision insights",
    description=(
        "Returns plain-language observations derived from the analytics data. "
        "Covers YoY accident trends, fatality share, night-time risk, and top blackspot summary."
    ),
)
def get_insights(
    upload_id: Optional[int] = Query(None, description="Filter to a specific upload"),
    db: Session = Depends(get_db),
):
    insights: list[InsightItem] = []

    # ─ Yearly trend for YoY change ────────────────────────────────
    acc_q = db.query(Accident.year, func.count(Accident.id).label("cnt"))
    if upload_id:
        acc_q = acc_q.filter(Accident.upload_id == upload_id)
    yearly = (
        acc_q.filter(Accident.year.isnot(None))
        .group_by(Accident.year)
        .order_by(Accident.year)
        .all()
    )

    if len(yearly) >= 2:
        y0_cnt = yearly[-2].cnt
        y1_cnt = yearly[-1].cnt
        y0_yr  = yearly[-2].year
        y1_yr  = yearly[-1].year
        if y0_cnt > 0:
            pct = round((y1_cnt - y0_cnt) / y0_cnt * 100, 1)
            trend = "down" if pct < 0 else ("up" if pct > 0 else "neutral")
            arrow = "↓" if trend == "down" else ("↑" if trend == "up" else "→")
            insights.append(InsightItem(
                metric     = "accidents",
                text       = f"Accidents {arrow} {abs(pct)}% from {y0_yr} to {y1_yr} ({y0_cnt} → {y1_cnt})",
                trend      = trend,
                value      = float(y1_cnt),
                pct_change = pct,
            ))

    # ─ Fatality share ─────────────────────────────────────────
    fat_q = db.query(
        func.sum(Accident.fatal).label("total_fatal"),
        func.count(Accident.id).label("total_acc"),
    )
    if upload_id:
        fat_q = fat_q.filter(Accident.upload_id == upload_id)
    fat_row = fat_q.one_or_none()
    if fat_row and fat_row.total_acc and fat_row.total_acc > 0:
        fat_pct = round((fat_row.total_fatal or 0) / fat_row.total_acc * 100, 1)
        insights.append(InsightItem(
            metric = "fatalities",
            text   = f"Fatalities account for {fat_pct}% of all accidents ({fat_row.total_fatal} deaths)",
            trend  = "neutral",
            value  = float(fat_row.total_fatal or 0),
        ))

    # ─ Night-time share ─────────────────────────────────────
    night_q = db.query(func.count(Accident.id).label("cnt"))
    if upload_id:
        night_q = night_q.filter(Accident.upload_id == upload_id)
    night_cnt = night_q.filter(
        Accident.time_of_day.in_(["Night", "Early Morning"])
    ).scalar() or 0
    total_cnt = (
        db.query(func.count(Accident.id))
        .filter(Accident.upload_id == upload_id if upload_id else True)
        .scalar() or 0
    )
    if total_cnt > 0:
        night_pct = round(night_cnt / total_cnt * 100, 1)
        insights.append(InsightItem(
            metric = "night_risk",
            text   = f"Night-time / early morning incidents: {night_pct}% of all accidents",
            trend  = "up" if night_pct > 30 else "neutral",
            value  = float(night_cnt),
        ))

    # ─ Top blackspot summary ────────────────────────────────
    bs_q = db.query(Blackspot).order_by(Blackspot.blackspot_rank_score.desc())
    if upload_id:
        bs_q = bs_q.filter(Blackspot.upload_id == upload_id)
    top_bs = bs_q.first()
    if top_bs:
        conf_label = (
            "Confirmed" if (top_bs.confidence_score or 0) >= 75
            else "Likely" if (top_bs.confidence_score or 0) >= 50
            else "Possible"
        )
        insights.append(InsightItem(
            metric = "top_blackspot",
            text   = (
                f"Most dangerous location: km {top_bs.segment_500m} — "
                f"{top_bs.risk_tier}, {top_bs.total_accidents} accidents, "
                f"{top_bs.total_fatal} fatal ({conf_label} confidence)"
            ),
            trend  = "up",
            value  = float(top_bs.blackspot_rank_score),
        ))

    # ─ Worst month ─────────────────────────────────────────
    month_q = db.query(
        Accident.month,
        func.count(Accident.id).label("cnt"),
    )
    if upload_id:
        month_q = month_q.filter(Accident.upload_id == upload_id)
    worst_month = (
        month_q.filter(Accident.month.isnot(None))
        .group_by(Accident.month)
        .order_by(func.count(Accident.id).desc())
        .first()
    )
    if worst_month:
        month_names = ["","Jan","Feb","Mar","Apr","May","Jun",
                       "Jul","Aug","Sep","Oct","Nov","Dec"]
        mname = month_names[worst_month.month] if 1 <= worst_month.month <= 12 else str(worst_month.month)
        insights.append(InsightItem(
            metric = "worst_month",
            text   = f"Peak accident month: {mname} ({worst_month.cnt} incidents)",
            trend  = "up",
            value  = float(worst_month.cnt),
        ))

    return insights


# ════════════════════════════════════════════════════════════════
# GET /analytics/persistent-blackspots
# Returns locations that appear in 2+ uploads with tier >= HIGH
# ════════════════════════════════════════════════════════════════

_TIER_PRIORITY = {"CRITICAL": 5, "HIGH": 4, "MODERATE": 3, "BLACK SPOT": 2, "WATCH ZONE": 1, "SAFE": 0}
_HIGH_TIER_SET = {"CRITICAL", "HIGH", "BLACK SPOT"}

@router.get(
    "/persistent-blackspots",
    response_model=list[PersistentBlackspot],
    summary="Persistent / chronic high-risk blackspots",
    description=(
        "Returns blackspot locations that appear in 2+ uploads AND have at least one "
        "occurrence with risk tier ≥ HIGH. Sorted by upload_count descending. "
        "is_chronic = True when upload_count ≥ 3."
    ),
)
def get_persistent_blackspots(db: Session = Depends(get_db)):
    # Fetch all blackspots, group by km (within ±0.25 km tolerance)
    all_bs: list[Blackspot] = (
        db.query(Blackspot)
        .order_by(Blackspot.segment_500m)
        .all()
    )

    # Cluster by km with tolerance
    groups: dict[float, list[Blackspot]] = {}
    for bs in all_bs:
        km = bs.segment_500m
        found = None
        for rep_km in groups:
            if abs(rep_km - km) <= 0.25:
                found = rep_km
                break
        if found is not None:
            groups[found].append(bs)
        else:
            groups[km] = [bs]

    # Fetch upload label map
    uploads = db.query(Upload.id, Upload.upload_label, Upload.original_filename).all()
    upload_label_map = {
        u.id: (u.upload_label or u.original_filename or f"Upload #{u.id}")
        for u in uploads
    }

    result: list[PersistentBlackspot] = []
    for rep_km, members in groups.items():
        # Count unique uploads
        unique_upload_ids = list({bs.upload_id for bs in members})
        if len(unique_upload_ids) < 2:
            continue
        # Must have at least one HIGH+ tier occurrence
        tiers = [(bs.risk_tier or "SAFE").upper() for bs in members]
        max_tier = max(tiers, key=lambda t: _TIER_PRIORITY.get(t, 0))
        if max_tier not in _HIGH_TIER_SET:
            continue

        avg_acc = round(sum(bs.total_accidents for bs in members) / len(members), 1)

        result.append(PersistentBlackspot(
            segment_500m  = rep_km,
            upload_count  = len(unique_upload_ids),
            upload_ids    = unique_upload_ids,
            upload_labels = [upload_label_map.get(uid) for uid in unique_upload_ids],
            risk_tiers    = tiers,
            max_risk_tier = max_tier,
            avg_accidents = avg_acc,
            is_chronic    = len(unique_upload_ids) >= 3,
        ))

    result.sort(key=lambda x: x.upload_count, reverse=True)
    return result


# ════════════════════════════════════════════════════════════════
# GET /analytics/freshness  — Data freshness timestamp for TopBar badge
# ════════════════════════════════════════════════════════════════

@router.get(
    "/freshness",
    response_model=DataFreshness,
    summary="Data freshness metadata",
    description="Returns the timestamp of the latest upload and pipeline completion, used for the UI freshness badge.",
)
def get_freshness(db: Session = Depends(get_db)):
    latest_upload = (
        db.query(Upload)
        .order_by(Upload.uploaded_at.desc())
        .first()
    )
    latest_completed = (
        db.query(Upload)
        .filter(Upload.status == "completed", Upload.pipeline_ended.isnot(None))
        .order_by(Upload.pipeline_ended.desc())
        .first()
    )
    total_uploads  = db.query(func.count(Upload.id)).scalar() or 0
    total_bs       = db.query(func.count(Blackspot.id)).scalar() or 0

    return DataFreshness(
        last_upload_at      = latest_upload.uploaded_at    if latest_upload    else None,
        last_completed_at   = latest_completed.pipeline_ended if latest_completed else None,
        latest_upload_label = (
            latest_completed.upload_label or latest_completed.original_filename
            if latest_completed else None
        ),
        total_uploads       = total_uploads,
        total_blackspots    = total_bs,
    )


# ════════════════════════════════════════════════════════════════
# GET /analytics/export/pdf  — Server-side PDF (v2 stub)
# ════════════════════════════════════════════════════════════════

@router.get(
    "/export/pdf",
    summary="Server-side PDF export (v2 placeholder)",
    description="Future: server-side reportlab PDF generation for large datasets. Currently returns a placeholder.",
)
def export_pdf_stub():
    return {
        "status": "not_implemented",
        "message": (
            "Server-side PDF generation is a v2 feature for datasets >5000 records. "
            "Use the client-side PDF export (POST from Reports page) for current use."
        ),
    }
