"""
app/routes/blackspots.py
─────────────────────────
Blackspot query endpoints.

Routes:
  GET /blackspots                  — All blackspots (paginated, filterable)
  GET /blackspots/{id}             — Single blackspot detail
  GET /blackspots/clusters/summary — DBSCAN cluster summary
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import Blackspot, Segment, Recommendation
from app.schemas import (
    BlackspotResponse, BlackspotListResponse, BlackspotDetailResponse,
    ClusterSummary, InlineRecommendation,
)

router = APIRouter(prefix="/blackspots", tags=["Blackspots"])


# ════════════════════════════════════════════════════════════════
# GET /blackspots  — List all blackspots
# ════════════════════════════════════════════════════════════════

@router.get(
    "",
    response_model=BlackspotListResponse,
    summary="Get all detected blackspots",
    description=(
        "Returns all blackspot records, optionally filtered by upload_id, "
        "risk_tier, or minimum accident count. Sorted by rank."
    ),
)
def list_blackspots(
    upload_id:   Optional[int] = Query(None, description="Filter by upload ID"),
    risk_tier:   Optional[str] = Query(None, description="Filter by risk tier (CRITICAL/HIGH/MODERATE/BLACK SPOT)"),
    min_accidents: Optional[int] = Query(None, description="Minimum total accidents"),
    skip:  int = Query(0,  ge=0,  description="Pagination offset"),
    limit: int = Query(50, ge=1, le=500, description="Results per page"),
    db: Session = Depends(get_db),
):
    query = db.query(Blackspot)

    if upload_id is not None:
        query = query.filter(Blackspot.upload_id == upload_id)

    if risk_tier is not None:
        query = query.filter(Blackspot.risk_tier.ilike(f"%{risk_tier}%"))

    if min_accidents is not None:
        query = query.filter(Blackspot.total_accidents >= min_accidents)

    total = query.count()
    blackspots = (
        query
        .order_by(Blackspot.rank.asc().nulls_last(),
                  Blackspot.blackspot_rank_score.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return BlackspotListResponse(total=total, blackspots=blackspots)


# ════════════════════════════════════════════════════════════════
# GET /blackspots/clusters/summary  — DBSCAN cluster summaries
# ════════════════════════════════════════════════════════════════

@router.get(
    "/clusters/summary",
    summary="Get DBSCAN cluster summary",
    description=(
        "Returns a summary of each spatial cluster of blackspots "
        "identified by DBSCAN. Useful for map cluster visualization."
    ),
)
def get_cluster_summary(
    upload_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Blackspot).filter(Blackspot.cluster_id >= 0)

    if upload_id is not None:
        query = query.filter(Blackspot.upload_id == upload_id)

    blackspots = query.all()

    if not blackspots:
        return {"clusters": [], "total_clusters": 0}

    # Group by cluster_id
    cluster_map: dict = {}
    for bs in blackspots:
        cid = bs.cluster_id
        if cid not in cluster_map:
            cluster_map[cid] = {
                "cluster_id":     cid,
                "blackspot_count": 0,
                "total_accidents": 0,
                "total_fatal":     0,
                "segment_kms":     [],
                "risk_tiers":      [],
            }
        cluster_map[cid]["blackspot_count"]  += 1
        cluster_map[cid]["total_accidents"]  += bs.total_accidents
        cluster_map[cid]["total_fatal"]      += bs.total_fatal
        cluster_map[cid]["segment_kms"].append(bs.segment_500m)
        cluster_map[cid]["risk_tiers"].append(bs.risk_tier or "SAFE")

    # Determine dominant risk tier per cluster
    result = []
    for cid, data in sorted(cluster_map.items()):
        from collections import Counter
        dominant_tier = Counter(data["risk_tiers"]).most_common(1)[0][0]
        result.append({
            "cluster_id":     cid,
            "blackspot_count": data["blackspot_count"],
            "total_accidents": data["total_accidents"],
            "total_fatal":     data["total_fatal"],
            "segment_kms":     sorted(data["segment_kms"]),
            "risk_tier":       dominant_tier,
        })

    return {"clusters": result, "total_clusters": len(result)}


# ════════════════════════════════════════════════════════════════
# GET /blackspots/{blackspot_id}  — Single blackspot FULL DETAIL
# ════════════════════════════════════════════════════════════════

@router.get(
    "/{blackspot_id}",
    response_model=BlackspotDetailResponse,
    summary="Get full blackspot detail with explainability",
    description=(
        "Returns complete blackspot data including IRC criteria A–E flags, "
        "adaptive thresholds used, confidence score, and inline recommendations. "
        "Single round-trip — no separate explainability endpoint needed."
    ),
)
def get_blackspot(blackspot_id: int, db: Session = Depends(get_db)):
    bs = db.get(Blackspot, blackspot_id)
    if not bs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Blackspot with id={blackspot_id} not found",
        )

    # ── Fetch joined segment for criteria + threshold data ───────────────
    seg: Segment | None = db.get(Segment, bs.segment_id) if bs.segment_id else None

    # ── Fetch inline recommendations ─────────────────────────────
    recs: list[Recommendation] = (
        db.query(Recommendation)
        .filter(Recommendation.blackspot_id == blackspot_id)
        .order_by(Recommendation.priority.asc())
        .all()
    )
    inline_recs = [
        InlineRecommendation(
            priority  = r.priority,
            category  = r.category,
            action    = r.action,
            rationale = r.rationale,
        )
        for r in recs
    ]

    # ── Build response ────────────────────────────────────────
    return BlackspotDetailResponse(
        # — Core blackspot fields —
        id                   = bs.id,
        upload_id            = bs.upload_id,
        segment_id           = bs.segment_id,
        segment_500m         = bs.segment_500m,
        rank                 = bs.rank,
        total_accidents      = bs.total_accidents,
        total_fatal          = bs.total_fatal,
        total_grievous       = bs.total_grievous,
        total_severity       = bs.total_severity,
        accident_rate        = bs.accident_rate,
        criteria_count       = bs.criteria_count,
        risk_tier            = bs.risk_tier,
        blackspot_rank_score = bs.blackspot_rank_score,
        dominant_cause       = bs.dominant_cause,
        dominant_nature      = bs.dominant_nature,
        dominant_vehicle     = bs.dominant_vehicle,
        dominant_time        = bs.dominant_time,
        locations            = bs.locations,
        cluster_id           = bs.cluster_id,
        detected_at          = bs.detected_at,
        confidence_score     = bs.confidence_score,
        latitude             = bs.latitude,
        longitude            = bs.longitude,
        # — Criteria + thresholds from joined Segment —
        criteria_a           = seg.criteria_a           if seg else False,
        criteria_b           = seg.criteria_b           if seg else False,
        criteria_c           = seg.criteria_c           if seg else False,
        criteria_d           = seg.criteria_d           if seg else False,
        criteria_e           = seg.criteria_e           if seg else False,
        accident_threshold   = seg.accident_threshold   if seg else None,
        severity_threshold   = seg.severity_threshold   if seg else None,
        fatal_threshold      = seg.fatal_threshold      if seg else None,
        grievous_threshold   = seg.grievous_threshold   if seg else None,
        rate_threshold       = seg.rate_threshold       if seg else None,
        # — Inline recommendations —
        recommendations      = inline_recs,
    )
