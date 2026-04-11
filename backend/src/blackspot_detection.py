"""
src/blackspot_detection.py
──────────────────────────
Stage 3 (Revised) — Adaptive Black Spot Detection + ML Enhancement.

Mirrors Stage 3 (Revised) of the notebook exactly:
  • 5 adaptive criteria (A–E) using percentile thresholds
  • Blackspot = any 2+ criteria met
  • Risk tier: CRITICAL / HIGH / MODERATE / BLACK SPOT / WATCH ZONE / SAFE
  • Blackspot rank score (weighted composite)
  • DBSCAN spatial clustering (ML enhancement)
  • Normalized 0–100 risk score

All threshold values come from app.config.settings so they're
configurable via .env without changing code.
"""

import numpy as np
import pandas as pd
from loguru import logger
from sklearn.cluster import DBSCAN
from sklearn.preprocessing import MinMaxScaler
from app.config import settings


# ════════════════════════════════════════════════════════════════
# STEP 1 — ADAPTIVE THRESHOLDS (Data-Driven Percentiles)
# ════════════════════════════════════════════════════════════════

def compute_adaptive_thresholds(segment_df: pd.DataFrame) -> dict:
    """
    Calculate data-driven thresholds using configurable percentiles.
    Mirrors notebook STEP 3: ADAPTIVE THRESHOLDS.

    Returns:
        dict with keys: accident, severity, fatal, grievous, rate
    """
    acc_pct  = settings.ACCIDENT_PERCENTILE
    sev_pct  = settings.SEVERITY_PERCENTILE
    fat_pct  = settings.FATAL_PERCENTILE
    grv_pct  = settings.GRIEVOUS_PERCENTILE
    rate_pct = settings.RATE_PERCENTILE

    thresholds = {
        "accident":  max(3, segment_df["total_accidents"].quantile(acc_pct / 100)),
        "severity":  max(5, segment_df["total_severity"].quantile(sev_pct  / 100)),
        "fatal":     max(1, segment_df["total_fatal"].quantile(fat_pct  / 100)),
        "grievous":  max(2, segment_df["total_grievous"].quantile(grv_pct  / 100)),
        "rate":      segment_df["accident_rate"].quantile(rate_pct / 100),
    }

    logger.info(
        f"Adaptive thresholds — "
        f"Acc≥{thresholds['accident']:.1f} | "
        f"Sev≥{thresholds['severity']:.1f} | "
        f"Fatal≥{thresholds['fatal']:.1f} | "
        f"Griev≥{thresholds['grievous']:.1f} | "
        f"Rate≥{thresholds['rate']:.2f}"
    )
    return thresholds


# ════════════════════════════════════════════════════════════════
# STEP 2 — APPLY CRITERIA A–E
# ════════════════════════════════════════════════════════════════

def apply_irc_criteria(segment_df: pd.DataFrame,
                       thresholds: dict) -> pd.DataFrame:
    """
    Apply all 5 detection criteria to the segment DataFrame.
    Mirrors notebook STEP 4: APPLY ALL 5 CRITERIA.

    Criteria:
      A — High accident frequency  (≥ accident threshold)
      B — High fatality count      (≥ fatal threshold)
      C — High severity score      (≥ severity threshold)
      D — High grievous injuries   (≥ grievous threshold)
      E — High accident rate/year  (≥ rate threshold)

    Blackspot = criteria_count >= BLACKSPOT_MIN_CRITERIA (default 2)
    Watch zone = criteria_count == 1
    """
    df = segment_df.copy()

    df["criteria_a"] = df["total_accidents"] >= thresholds["accident"]
    df["criteria_b"] = df["total_fatal"]     >= thresholds["fatal"]
    df["criteria_c"] = df["total_severity"]  >= thresholds["severity"]
    df["criteria_d"] = df["total_grievous"]  >= thresholds["grievous"]
    df["criteria_e"] = df["accident_rate"]   >= thresholds["rate"]

    df["criteria_count"] = (
        df["criteria_a"].astype(int) +
        df["criteria_b"].astype(int) +
        df["criteria_c"].astype(int) +
        df["criteria_d"].astype(int) +
        df["criteria_e"].astype(int)
    )

    min_criteria = settings.BLACKSPOT_MIN_CRITERIA
    df["is_blackspot"]  = df["criteria_count"] >= min_criteria
    df["is_watch_zone"] = df["criteria_count"] == 1

    # Store the threshold values in each row for audit trail
    df["accident_threshold"] = thresholds["accident"]
    df["severity_threshold"] = thresholds["severity"]
    df["fatal_threshold"]    = thresholds["fatal"]
    df["grievous_threshold"] = thresholds["grievous"]
    df["rate_threshold"]     = thresholds["rate"]

    return df


# ════════════════════════════════════════════════════════════════
# STEP 3 — RISK TIER LABELING
# ════════════════════════════════════════════════════════════════

def assign_risk_tier(row: pd.Series) -> str:
    """
    Assign human-readable risk tier based on criteria_count.
    Mirrors notebook risk_tier() function exactly.
    """
    c = row["criteria_count"]
    if c >= 5: return "CRITICAL"
    if c >= 4: return "HIGH"
    if c >= 3: return "MODERATE"
    if c >= 2: return "BLACK SPOT"
    if c == 1: return "WATCH ZONE"
    return "SAFE"


# ════════════════════════════════════════════════════════════════
# STEP 4 — BLACKSPOT RANK SCORE
# ════════════════════════════════════════════════════════════════

def compute_rank_score(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute the composite blackspot rank score.
    Mirrors notebook STEP 7: RANK SCORE exactly.

    Formula:
      rank_score = accidents×2 + fatal×10 + grievous×5 + severity×1 + rate×3
    """
    df["blackspot_rank_score"] = (
        df["total_accidents"] * 2   +
        df["total_fatal"]     * 10  +
        df["total_grievous"]  * 5   +
        df["total_severity"]  * 1   +
        df["accident_rate"]   * 3
    ).round(2)
    return df


# ════════════════════════════════════════════════════════════════
# STEP 5 — ML: DBSCAN SPATIAL CLUSTERING
# ════════════════════════════════════════════════════════════════

def run_dbscan_clustering(segment_df: pd.DataFrame,
                           eps: float = 1.0,
                           min_samples: int = 2) -> pd.DataFrame:
    """
    Apply DBSCAN clustering on the segment_500m axis of detected blackspots.
    Groups geographically close blackspots into clusters for map visualization.

    Since our data is 1D (chainage km), we cluster on segment_500m directly.
    eps = 1.0 means segments within 1 km are grouped together.

    cluster_id = -1 means the segment is a noise point (isolated blackspot).

    Returns the segment_df with a new 'cluster_id' column.
    """
    df = segment_df.copy()
    df["cluster_id"] = -1  # default: unclustered

    bs_mask = df["is_blackspot"]
    bs_data = df[bs_mask].copy()

    if len(bs_data) < 2:
        logger.warning(
            f"Only {len(bs_data)} blackspot(s) — skipping DBSCAN clustering"
        )
        return df

    # Feature: segment_500m (1D chainage position)
    X = bs_data[["segment_500m"]].values

    try:
        db = DBSCAN(eps=eps, min_samples=min_samples, metric="euclidean")
        labels = db.fit_predict(X)
        df.loc[bs_mask, "cluster_id"] = labels

        n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
        n_noise    = list(labels).count(-1)
        logger.info(
            f"DBSCAN clustering — {n_clusters} clusters, "
            f"{n_noise} isolated blackspots (noise)"
        )
    except Exception as e:
        logger.warning(f"DBSCAN clustering failed: {e} — cluster_id will be -1")

    return df


# ════════════════════════════════════════════════════════════════
# STEP 6 — ML: NORMALIZED RISK SCORE (0–100)
# ════════════════════════════════════════════════════════════════

def compute_normalized_risk_score(segment_df: pd.DataFrame) -> pd.DataFrame:
    """
    Normalize the blackspot_rank_score to a 0–100 scale.
    This is an ML enhancement for front-end map color coding.

    Also adds a normalized_risk_score column.
    """
    if segment_df["blackspot_rank_score"].max() == 0:
        segment_df["normalized_risk_score"] = 0.0
        return segment_df

    scaler = MinMaxScaler(feature_range=(0, 100))
    scores = segment_df["blackspot_rank_score"].values.reshape(-1, 1)
    segment_df["normalized_risk_score"] = scaler.fit_transform(scores).flatten().round(1)
    return segment_df


# ════════════════════════════════════════════════════════════════
# MASTER FUNCTION — detect_blackspots()
# ════════════════════════════════════════════════════════════════

def detect_blackspots(segment_df: pd.DataFrame,
                       dbscan_eps: float = 1.0,
                       min_samples: int = 2) -> pd.DataFrame:
    """
    Full Stage 3 (Revised) blackspot detection pipeline.

    Steps:
      1. Compute adaptive thresholds (percentile-based)
      2. Apply criteria A–E
      3. Assign risk tiers
      4. Compute blackspot rank score
      5. Run DBSCAN spatial clustering (ML)
      6. Normalize risk scores (ML)
      7. Rank blackspots
      8. Log summary

    Args:
        segment_df:  Output of segmentation.aggregate_segments()
        dbscan_eps:  DBSCAN epsilon in km (default 1.0 = 1km)
        min_samples: DBSCAN min_samples (default 2)

    Returns:
        Full segment_df with all detection columns added.
    """
    logger.info("=== Stage 3: Black Spot Detection (Adaptive) ===")

    # Step 1 — Thresholds
    if settings.USE_ADAPTIVE_THRESHOLDS:
        thresholds = compute_adaptive_thresholds(segment_df)
    else:
        # Fall back to fixed IRC thresholds from .env
        thresholds = {
            "accident": settings.BLACKSPOT_THRESHOLD,
            "fatal":    10,
            "severity": 15,
            "grievous": 5,
            "rate":     2.0,
        }
        logger.info(f"Using fixed IRC thresholds: {thresholds}")

    # Step 2 — Apply criteria
    segment_df = apply_irc_criteria(segment_df, thresholds)

    # Step 3 — Risk tier
    segment_df["risk_tier"] = segment_df.apply(assign_risk_tier, axis=1)

    # Step 4 — Rank score
    segment_df = compute_rank_score(segment_df)

    # Step 5 — DBSCAN clustering
    segment_df = run_dbscan_clustering(segment_df, dbscan_eps, min_samples)

    # Step 6 — Normalized score
    segment_df = compute_normalized_risk_score(segment_df)

    # Step 7 — Rank blackspots (sorted by rank score desc)
    blackspot_mask = segment_df["is_blackspot"]
    segment_df["rank"] = np.nan
    ranked_idx = (
        segment_df[blackspot_mask]
        .sort_values("blackspot_rank_score", ascending=False)
        .index
    )
    segment_df.loc[ranked_idx, "rank"] = range(1, len(ranked_idx) + 1)

    # Step 8 — Summary
    n_blackspots  = int(blackspot_mask.sum())
    n_watch_zones = int(segment_df["is_watch_zone"].sum())
    n_total       = len(segment_df)

    logger.success(
        f"Detection complete — "
        f"🚨 {n_blackspots} Black Spots | "
        f"⚠️  {n_watch_zones} Watch Zones | "
        f"📍 {n_total} total segments | "
        f"density: {n_blackspots/n_total*100:.1f}%"
    )

    # Log tier breakdown
    tier_counts = segment_df["risk_tier"].value_counts()
    for tier, count in tier_counts.items():
        logger.info(f"  {tier}: {count}")

    return segment_df


def get_blackspots_df(segment_df: pd.DataFrame) -> pd.DataFrame:
    """
    Filter and sort segment_df to only return detected blackspots,
    rank-ordered by blackspot_rank_score.

    Returns a DataFrame matching the notebook's `blackspots` variable.
    """
    blackspots = (
        segment_df[segment_df["is_blackspot"]]
        .sort_values("blackspot_rank_score", ascending=False)
        .reset_index(drop=True)
    )
    blackspots["rank"] = blackspots.index + 1
    return blackspots
