"""
app/routes/recommendations.py
──────────────────────────────
Recommendation query endpoints.

Routes:
  GET /api/v1/recommendations                        — All recs (paginated)
  GET /api/v1/recommendations/blackspot/{id}         — Per blackspot
  GET /api/v1/recommendations/summary                — Category + priority breakdown
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import Recommendation
from app.schemas import RecommendationResponse, RecommendationListResponse, RecommendationSummary
from app.services.recommendation_service import get_recommendations_for_blackspot

router = APIRouter(prefix="/recommendations", tags=["Recommendations"])


# ════════════════════════════════════════════════════════════════
# GET /recommendations/summary  (before /{id} to avoid routing conflict)
# ════════════════════════════════════════════════════════════════

@router.get(
    "/summary",
    response_model=RecommendationSummary,
    summary="Recommendation summary — counts by category and priority",
)
def get_recommendations_summary(
    upload_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Recommendation)
    if upload_id is not None:
        query = query.filter(Recommendation.upload_id == upload_id)

    total = query.count()

    # Category breakdown
    cat_rows = (
        query.with_entities(Recommendation.category, func.count(Recommendation.id))
        .group_by(Recommendation.category)
        .all()
    )
    # Priority breakdown
    pri_rows = (
        query.with_entities(Recommendation.priority, func.count(Recommendation.id))
        .group_by(Recommendation.priority)
        .all()
    )

    return RecommendationSummary(
        total              = total,
        by_category        = {cat: cnt for cat, cnt in cat_rows},
        by_priority        = {pri: cnt for pri, cnt in pri_rows},
    )


# ════════════════════════════════════════════════════════════════
# GET /recommendations  — All (paginated + filterable)
# ════════════════════════════════════════════════════════════════

@router.get(
    "",
    response_model=RecommendationListResponse,
    summary="List all recommendations",
    description=(
        "Returns all recommendations across all blackspots, "
        "filterable by upload_id, priority, or category."
    ),
)
def list_recommendations(
    upload_id: Optional[int] = Query(None),
    priority:  Optional[str] = Query(None, description="HIGH | MEDIUM | LOW"),
    category:  Optional[str] = Query(None, description="e.g. Infrastructure"),
    skip:  int = Query(0,   ge=0),
    limit: int = Query(50,  ge=1, le=500),
    db: Session = Depends(get_db),
):
    query = db.query(Recommendation)
    if upload_id is not None:
        query = query.filter(Recommendation.upload_id == upload_id)
    if priority is not None:
        query = query.filter(Recommendation.priority.ilike(f"%{priority}%"))
    if category is not None:
        query = query.filter(Recommendation.category.ilike(f"%{category}%"))

    total = query.count()
    recs = (
        query
        .order_by(Recommendation.priority.asc(), Recommendation.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return RecommendationListResponse(total=total, recommendations=recs)


# ════════════════════════════════════════════════════════════════
# GET /recommendations/blackspot/{blackspot_id}
# ════════════════════════════════════════════════════════════════

@router.get(
    "/blackspot/{blackspot_id}",
    response_model=RecommendationListResponse,
    summary="Get recommendations for a specific blackspot",
    description=(
        "Returns all action recommendations for the given blackspot ID, "
        "sorted by priority (HIGH → MEDIUM → LOW)."
    ),
)
def get_blackspot_recommendations(
    blackspot_id: int,
    db: Session = Depends(get_db),
):
    recs = get_recommendations_for_blackspot(db, blackspot_id)
    if not recs:
        # Check if blackspot exists at all
        from app.models import Blackspot
        bs = db.get(Blackspot, blackspot_id)
        if not bs:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Blackspot with id={blackspot_id} not found",
            )
        # Blackspot exists but no recs yet (pipeline hasn't generated them)
        return RecommendationListResponse(total=0, recommendations=[])

    return RecommendationListResponse(total=len(recs), recommendations=recs)
