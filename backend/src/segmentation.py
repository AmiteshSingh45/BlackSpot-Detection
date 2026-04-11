"""
src/segmentation.py
────────────────────
Stage 2 (aggregation) — Convert accident-level records into
500m segment-level aggregates.

This is the `segment_df = df.groupby('segment_500m').agg(...)` block
from Stage 3 of the notebook, extracted into its own module.
"""

import numpy as np
import pandas as pd
from loguru import logger


# ── Columns we aggregate ────────────────────────────────────────
AGG_SPEC = {
    "total_accidents":   ("sr_no",           "count"),
    "total_fatal":       ("fatal",            "sum"),
    "total_grievous":    ("grievous",         "sum"),
    "total_minor":       ("minor",            "sum"),
    "total_non_injured": ("non_injured",      "sum"),
    "total_severity":    ("severity_score",   "sum"),
    "avg_severity":      ("severity_score",   "mean"),
    "years_active":      ("year",             "nunique"),
}

# Dominant value columns (mode of categorical features)
DOMINANT_COLS = {
    "dominant_nature":  "nature",
    "dominant_cause":   "causes",
    "dominant_vehicle": "vehicle_type",
    "dominant_time":    "time_of_day",
}


def _safe_mode(series: pd.Series) -> str:
    """Return the most common non-null value in a Series."""
    vals = series.dropna()
    if vals.empty:
        return "Unknown"
    return vals.value_counts().index[0]


def aggregate_segments(df: pd.DataFrame) -> pd.DataFrame:
    """
    Aggregate accident-level data into 500m highway segment summaries.

    This directly mirrors the `segment_df = df.groupby('segment_500m').agg(...)`
    code from Stage 3 of the notebook.

    Returns a DataFrame with one row per 500m segment.
    """
    logger.info("=== Segmentation: Aggregating into 500m segments ===")

    if "segment_500m" not in df.columns:
        raise ValueError(
            "'segment_500m' column is missing. "
            "Run preprocessing.engineer_features() first."
        )

    # Drop rows with no valid segment assignment
    df_valid = df[df["segment_500m"].notna()].copy()
    logger.info(
        f"Records with valid segment_500m: {len(df_valid)} / {len(df)}"
    )

    if df_valid.empty:
        raise ValueError(
            "No records have a valid segment_500m. "
            "Check that location_chainage values are in '284+300' format."
        )

    # ── Handle missing sr_no ─────────────────────────────────────
    if "sr_no" not in df_valid.columns:
        df_valid["sr_no"] = range(len(df_valid))

    # ── Build agg dict dynamically (only use cols that exist) ────
    agg_dict = {}
    for out_col, (src_col, func) in AGG_SPEC.items():
        if src_col in df_valid.columns:
            agg_dict[src_col] = func

    segment_df = df_valid.groupby("segment_500m").agg(**{
        out_col: pd.NamedAgg(column=src_col, aggfunc=func)
        for out_col, (src_col, func) in AGG_SPEC.items()
        if src_col in df_valid.columns
    }).reset_index()

    # ── Add dominant categorical fields ─────────────────────────
    for out_col, src_col in DOMINANT_COLS.items():
        if src_col in df_valid.columns:
            dom = (
                df_valid.groupby("segment_500m")[src_col]
                .apply(_safe_mode)
                .reset_index()
                .rename(columns={src_col: out_col})
            )
            segment_df = segment_df.merge(dom, on="segment_500m", how="left")
        else:
            segment_df[out_col] = "Unknown"

    # ── Locations: top 3 unique accident_location values ────────
    if "accident_location" in df_valid.columns:
        loc_agg = (
            df_valid.groupby("segment_500m")["accident_location"]
            .apply(lambda x: ", ".join(x.dropna().unique()[:3]))
            .reset_index()
            .rename(columns={"accident_location": "locations"})
        )
        segment_df = segment_df.merge(loc_agg, on="segment_500m", how="left")
    else:
        segment_df["locations"] = ""

    # ── Accident rate per year ───────────────────────────────────
    segment_df["years_active"]  = segment_df["years_active"].replace(0, 1)
    segment_df["accident_rate"] = (
        segment_df["total_accidents"] / segment_df["years_active"]
    ).round(2)

    # ── Fill nulls ───────────────────────────────────────────────
    int_cols = ["total_accidents", "total_fatal", "total_grievous",
                "total_minor", "total_non_injured", "years_active"]
    for col in int_cols:
        if col in segment_df.columns:
            segment_df[col] = segment_df[col].fillna(0).astype(int)

    float_cols = ["total_severity", "avg_severity", "accident_rate"]
    for col in float_cols:
        if col in segment_df.columns:
            segment_df[col] = segment_df[col].fillna(0.0).round(3)

    logger.success(
        f"Segmentation complete — {len(segment_df)} segments | "
        f"max accidents in one segment: {segment_df['total_accidents'].max()} "
        f"at km {segment_df.loc[segment_df['total_accidents'].idxmax(), 'segment_500m']}"
    )

    # ── Log distribution summary (notebook STEP 2) ───────────────
    logger.info(
        f"Segment stats — "
        f"mean accidents: {segment_df['total_accidents'].mean():.2f}, "
        f"75th pct: {segment_df['total_accidents'].quantile(0.75):.2f}, "
        f"95th pct: {segment_df['total_accidents'].quantile(0.95):.2f}"
    )

    return segment_df
