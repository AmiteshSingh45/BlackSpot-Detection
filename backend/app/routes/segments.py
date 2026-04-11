"""
app/routes/segments.py
───────────────────────
Segment query endpoints.

Routes:
  GET /segments              — All 500m segments (paginated, filterable)
  GET /segments/{segment_km} — Single segment by km position
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Segment
from app.schemas import SegmentResponse, SegmentListResponse

router = APIRouter(prefix="/segments", tags=["Segments"])


# ════════════════════════════════════════════════════════════════
# GET /segments  — All segments
# ════════════════════════════════════════════════════════════════

@router.get(
    "",
    response_model=SegmentListResponse,
    summary="Get all road segments",
    description=(
        "Returns all 500m road segments with their aggregated accident counts, "
        "severity scores, and blackspot classification. "
        "Use is_blackspot=true to filter only blackspots."
    ),
)
def list_segments(
    upload_id:    Optional[int]  = Query(None, description="Filter by upload ID"),
    is_blackspot: Optional[bool] = Query(None, description="Filter blackspots only"),
    is_watch_zone:Optional[bool] = Query(None, description="Filter watch zones only"),
    risk_tier:    Optional[str]  = Query(None, description="Filter by risk tier"),
    min_km:       Optional[float]= Query(None, description="Minimum chainage km"),
    max_km:       Optional[float]= Query(None, description="Maximum chainage km"),
    skip:  int = Query(0,   ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    query = db.query(Segment)

    if upload_id is not None:
        query = query.filter(Segment.upload_id == upload_id)

    if is_blackspot is not None:
        query = query.filter(Segment.is_blackspot == is_blackspot)

    if is_watch_zone is not None:
        query = query.filter(Segment.is_watch_zone == is_watch_zone)

    if risk_tier is not None:
        query = query.filter(Segment.risk_tier.ilike(f"%{risk_tier}%"))

    if min_km is not None:
        query = query.filter(Segment.segment_500m >= min_km)

    if max_km is not None:
        query = query.filter(Segment.segment_500m <= max_km)

    total    = query.count()
    segments = (
        query
        .order_by(Segment.segment_500m.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return SegmentListResponse(total=total, segments=segments)


# ════════════════════════════════════════════════════════════════
# GET /segments/{segment_km}  — Single segment by km
# ════════════════════════════════════════════════════════════════

@router.get(
    "/{segment_km}",
    response_model=SegmentResponse,
    summary="Get a single segment by chainage km",
    description=(
        "Returns the segment record matching the given chainage km mark. "
        "Example: /segments/284.0 returns the segment starting at KM 284.0"
    ),
)
def get_segment_by_km(
    segment_km: float,
    upload_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Segment).filter(Segment.segment_500m == segment_km)
    if upload_id is not None:
        query = query.filter(Segment.upload_id == upload_id)

    segment = query.first()
    if not segment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Segment at km={segment_km} not found",
        )
    return segment
