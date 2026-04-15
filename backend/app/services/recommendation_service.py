"""
app/services/recommendation_service.py
────────────────────────────────────────
Rule-based recommendation engine.

For every detected blackspot the engine analyses:
  • risk_tier       — overall severity
  • dominant_cause  — top accident cause
  • dominant_time   — most dangerous time period
  • dominant_nature — collision type
  • criteria flags  — which IRC criteria were triggered

It produces a ranked list of (priority, category, action, rationale)
records and persists them to the `recommendations` table.

Design principles:
  • Pure rules → fully explainable (important for government stakeholders)
  • Each rule is a Python function → trivial to add/modify
  • Idempotent: clears previous recs for the upload before re-inserting
  • Priority: HIGH → immediate action, MEDIUM → planned, LOW → monitor
"""

from __future__ import annotations

from loguru import logger
from sqlalchemy.orm import Session

from app.models import Blackspot, Recommendation


# ════════════════════════════════════════════════════════════════
# Rule definitions
# Each rule is a function: (Blackspot) → list of (priority, category, action, rationale)
# ════════════════════════════════════════════════════════════════

RuleOutput = list[tuple[str, str, str, str]]  # (priority, category, action, rationale)


def _rule_critical_tier(bs: Blackspot) -> RuleOutput:
    tier = (bs.risk_tier or "").upper()
    if tier == "CRITICAL":
        return [
            (
                "HIGH", "Emergency",
                "Commission immediate road safety audit and emergency intervention",
                f"CRITICAL tier — {bs.criteria_count}/5 IRC criteria triggered; "
                f"rank score {bs.blackspot_rank_score:.1f}",
            ),
            (
                "HIGH", "Enforcement",
                "Deploy 24/7 traffic police patrol at this location",
                "CRITICAL blackspot requires continuous law-enforcement presence",
            ),
        ]
    if tier == "HIGH":
        return [
            (
                "HIGH", "Enforcement",
                "Deploy traffic patrol during peak accident hours",
                f"HIGH-risk blackspot — {bs.total_fatal} fatalities recorded",
            ),
        ]
    return []


def _rule_fatality_count(bs: Blackspot) -> RuleOutput:
    if (bs.total_fatal or 0) >= 5:
        return [
            (
                "HIGH", "Infrastructure",
                "Install vehicle median crash barriers (w-beam or concrete jersey)",
                f"{bs.total_fatal} fatal accidents — median barrier prevents head-on collisions",
            ),
        ]
    return []


def _rule_dominant_cause(bs: Blackspot) -> RuleOutput:
    cause = (bs.dominant_cause or "").lower()
    results: RuleOutput = []

    if any(k in cause for k in ("over speed", "overspeeding", "speed")):
        results.append((
            "HIGH", "Infrastructure",
            "Install speed breakers, rumble strips, and automated speed cameras",
            f"Dominant cause: '{bs.dominant_cause}' — speed reduction measures mandatory",
        ))
    if any(k in cause for k in ("drunk", "alcohol", "inebriated")):
        results.append((
            "HIGH", "Enforcement",
            "Set up night-time drunk-driving check posts",
            f"Dominant cause: '{bs.dominant_cause}' — alcohol enforcement required",
        ))
    if any(k in cause for k in ("overtaking", "wrong side")):
        results.append((
            "HIGH", "Infrastructure",
            "Install no-overtaking road markings and convex mirrors on bends",
            f"Dominant cause: '{bs.dominant_cause}'",
        ))
    if any(k in cause for k in ("pedestrian", "jay walking")):
        results.append((
            "HIGH", "Infrastructure",
            "Construct pedestrian guard rails, zebra crossings, and foot over-bridges",
            f"Dominant cause: '{bs.dominant_cause}' — pedestrian infrastructure required",
        ))
    if any(k in cause for k in ("tyre", "mechanical", "brake")):
        results.append((
            "MEDIUM", "Enforcement",
            "Establish vehicle fitness check posts near this segment",
            f"Dominant cause: '{bs.dominant_cause}' — mechanical failures prevalent",
        ))
    if any(k in cause for k in ("distracted", "mobile", "phone")):
        results.append((
            "MEDIUM", "Enforcement",
            "Deploy mobile phone enforcement campaigns and awareness boards",
            f"Dominant cause: '{bs.dominant_cause}'",
        ))
    return results


def _rule_dominant_time(bs: Blackspot) -> RuleOutput:
    time_str = (bs.dominant_time or "").lower()
    results: RuleOutput = []

    if any(k in time_str for k in ("night", "midnight", "late")):
        results.append((
            "HIGH", "Lighting",
            "Install high-mast LED street lighting along this 500 m segment",
            f"Peak accident time: '{bs.dominant_time}' — darkness is a key risk factor",
        ))
        results.append((
            "MEDIUM", "Signage",
            "Place retroreflective road markings and delineators",
            "Night-time visibility enhancement",
        ))
    if any(k in time_str for k in ("dawn", "dusk", "evening")):
        results.append((
            "MEDIUM", "Lighting",
            "Improve dusk/dawn lighting and install solar-powered blinkers",
            f"Peak accident time: '{bs.dominant_time}' — low-light conditions",
        ))
    if any(k in time_str for k in ("morning", "peak", "rush")):
        results.append((
            "MEDIUM", "Enforcement",
            "Deploy traffic management personnel during morning rush hours",
            f"Peak accident time: '{bs.dominant_time}'",
        ))
    return results


def _rule_dominant_nature(bs: Blackspot) -> RuleOutput:
    nature = (bs.dominant_nature or "").lower()
    results: RuleOutput = []

    if any(k in nature for k in ("head-on", "head on", "frontal")):
        results.append((
            "HIGH", "Infrastructure",
            "Install centre-line rumble strips and no-overtaking markings",
            f"Dominant collision type: '{bs.dominant_nature}'",
        ))
    if any(k in nature for k in ("rear", "rear-end", "tailgating")):
        results.append((
            "MEDIUM", "Signage",
            "Install 'Maintain Safe Distance' boards and speed advisory signs",
            f"Dominant collision type: '{bs.dominant_nature}'",
        ))
    if any(k in nature for k in ("rollover", "skid", "roll over")):
        results.append((
            "HIGH", "Infrastructure",
            "Apply anti-skid bituminous surface treatment on this segment",
            f"Dominant collision type: '{bs.dominant_nature}' — surface grip deficiency",
        ))
    return results


def _rule_accident_rate(bs: Blackspot) -> RuleOutput:
    rate = bs.accident_rate or 0.0
    if rate >= 5.0:
        return [
            (
                "HIGH", "Signage",
                "Install 'Accident-Prone Zone' warning boards 500 m in advance",
                f"Accident rate: {rate:.1f}/yr — mandatory IRC warning signage",
            ),
        ]
    if rate >= 2.0:
        return [
            (
                "MEDIUM", "Signage",
                "Install caution boards and reduce speed-limit signing",
                f"Accident rate: {rate:.1f}/yr",
            ),
        ]
    return []


def _rule_watch_zone_and_cluster(bs: Blackspot) -> RuleOutput:
    """Add a monitoring recommendation for clustered / borderline segments."""
    results: RuleOutput = []
    # cluster_id >= 0 means it's part of a DBSCAN cluster
    if (bs.cluster_id is not None and bs.cluster_id >= 0):
        results.append((
            "LOW", "Infrastructure",
            "Coordinate safety measures with adjacent blackspot cluster "
            f"(cluster #{bs.cluster_id}) for corridor-level intervention",
            "DBSCAN spatial cluster — corridor-level treatment more effective than spot fixes",
        ))
    return results


# ════════════════════════════════════════════════════════════════
# Deduplication helper
# ════════════════════════════════════════════════════════════════

def _deduplicate(items: RuleOutput) -> RuleOutput:
    """Remove duplicate (category, action) pairs keeping highest priority."""
    seen: set[tuple[str, str]] = set()
    result: RuleOutput = []
    priority_order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    for priority, category, action, rationale in sorted(
        items, key=lambda x: priority_order.get(x[0], 9)
    ):
        key = (category, action[:50])
        if key not in seen:
            seen.add(key)
            result.append((priority, category, action, rationale))
    return result


# ════════════════════════════════════════════════════════════════
# All rules in evaluation order
# ════════════════════════════════════════════════════════════════

_ALL_RULES = [
    _rule_critical_tier,
    _rule_fatality_count,
    _rule_dominant_cause,
    _rule_dominant_time,
    _rule_dominant_nature,
    _rule_accident_rate,
    _rule_watch_zone_and_cluster,
]


def _apply_rules(bs: Blackspot) -> RuleOutput:
    all_recs: RuleOutput = []
    for rule_fn in _ALL_RULES:
        try:
            all_recs.extend(rule_fn(bs))
        except Exception as exc:
            logger.warning(f"Rule {rule_fn.__name__} failed for bs_id={bs.id}: {exc}")
    return _deduplicate(all_recs)


# ════════════════════════════════════════════════════════════════
# Public API
# ════════════════════════════════════════════════════════════════

def generate_recommendations(db: Session, upload_id: int) -> int:
    """
    Generate and persist Recommendation records for all blackspots
    in an upload. Idempotent — removes old recs first.

    Returns the total number of recommendations created.
    """
    logger.info(f"Generating recommendations for upload_id={upload_id}…")

    # Idempotency: clear stale records
    existing = db.query(Recommendation).filter(
        Recommendation.upload_id == upload_id
    ).count()
    if existing:
        db.query(Recommendation).filter(
            Recommendation.upload_id == upload_id
        ).delete()
        db.flush()

    blackspots: list[Blackspot] = (
        db.query(Blackspot)
        .filter(Blackspot.upload_id == upload_id)
        .order_by(Blackspot.blackspot_rank_score.desc())
        .all()
    )

    total = 0
    for bs in blackspots:
        raw_recs = _apply_rules(bs)
        for priority, category, action, rationale in raw_recs:
            rec = Recommendation(
                blackspot_id = bs.id,
                upload_id    = upload_id,
                priority     = priority,
                category     = category,
                action       = action,
                rationale    = rationale,
            )
            db.add(rec)
            total += 1

    db.flush()
    db.commit()
    logger.success(
        f"Created {total} recommendations across "
        f"{len(blackspots)} blackspots (upload_id={upload_id})"
    )
    return total


def get_recommendations_for_blackspot(
    db: Session, blackspot_id: int
) -> list[Recommendation]:
    """Retrieve all recommendations for a single blackspot, priority-sorted."""
    priority_order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    recs = (
        db.query(Recommendation)
        .filter(Recommendation.blackspot_id == blackspot_id)
        .all()
    )
    return sorted(recs, key=lambda r: priority_order.get(r.priority, 9))
