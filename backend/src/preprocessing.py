"""
src/preprocessing.py
─────────────────────
Stage 1 (cleaning) + Stage 2 (feature engineering).

Mirrors notebook logic exactly:
  • Stage 1 — Handle 'Unknown', drop nulls, parse dates
  • Stage 2 — Extract chainage_km, datetime features,
              severity_score, severity_label, segment_500m / segment_1km
"""

import re
import numpy as np
import pandas as pd
from loguru import logger
from app.config import settings


# ════════════════════════════════════════════════════════════════
# STAGE 1 — DATA CLEANING
# ════════════════════════════════════════════════════════════════

# Notebook Stage 2.2: fix known dirty classification values
CLASSIFICATION_FIXES = {
    "2 & 3":      "Grievous Injury",
    "--":         "Unknown",
    "Unknown(0)": "Unknown",
    "Unknown(5)": "Unknown",
    "Unknown(6)": "Unknown",
    "Unknown(7)": "Unknown",
    "Unknown(8)": "Unknown",
    "Unknown(9)": "Unknown",
    "Unknown(10)": "Unknown",
}

# Columns to drop before modelling (not useful for ML)
DROP_COLS = ["remarks", "animals_killed", "help", "side", "vehicle_reg"]


def handle_missing(df: pd.DataFrame) -> pd.DataFrame:
    """
    Replace 'Unknown' strings with NaN so pandas treats them uniformly.
    Mirrors: df = df.replace('Unknown', np.nan) → df = df.dropna()
    """
    logger.info("Handling missing & 'Unknown' values...")
    before = len(df)

    df = df.replace("Unknown", np.nan)

    # Drop rows where date is missing — ONLY if column exists
    if "date" in df.columns:
        df = df.dropna(subset=["date"])

    logger.info(f"Rows after handling missing values: {len(df)} (removed {before - len(df)})")
    return df


def drop_low_value_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Drop columns that are not useful for modelling (Stage 2.1).
    """
    cols_to_drop = [c for c in DROP_COLS if c in df.columns]
    if cols_to_drop:
        df.drop(columns=cols_to_drop, inplace=True)
        logger.info(f"Dropped low-value columns: {cols_to_drop}")
    return df


def fix_classification_values(df: pd.DataFrame) -> pd.DataFrame:
    """
    Fix known dirty / inconsistent classification values (Stage 2.2).
    """
    if "classification" in df.columns:
        df["classification"] = df["classification"].replace(CLASSIFICATION_FIXES)
    if "nature" in df.columns:
        df["nature"] = df["nature"].replace({"--": "Unknown"})
    if "causes" in df.columns:
        df["causes"] = df["causes"].replace({"--": "Unknown"})
    logger.info("Classification values cleaned")
    return df


def clean_data(df: pd.DataFrame) -> pd.DataFrame:
    """
    Master cleaning function — runs all Stage 1/2 cleaning steps in order.
    Call this before any feature engineering.
    """
    logger.info("=== Stage 1: Data Cleaning ===")

    df = drop_low_value_columns(df)
    df = fix_classification_values(df)

    # Parse date FIRST so that NaN-based dropping works correctly
    # (Excel serial numbers / datetime objects / strings all handled)
    if "date" in df.columns:
        df["date"] = pd.to_datetime(df["date"], errors="coerce")
    else:
        raise KeyError(
            "Required column 'date' not found in dataset. "
            "Column names present: " + str(df.columns.tolist())
        )

    df = handle_missing(df)    # now drops rows where date is NaT
    df = df.dropna(subset=["date"])  # second pass: remove any remaining NaT
    df = df.reset_index(drop=True)

    logger.success(f"Cleaning complete — {df.shape[0]} records remaining")
    return df


# ════════════════════════════════════════════════════════════════
# STAGE 2 — FEATURE ENGINEERING HELPERS
# ════════════════════════════════════════════════════════════════

def extract_chainage_km(val) -> float:
    """
    Extract decimal km from chainage strings like '284+300, LHS'.
    Mirrors the notebook function exactly:
      '284+300, LHS' → 284.3
      '469+600, RHS' → 469.6
      '318+320'      → 318.32
    Returns np.nan if no match.
    """
    if pd.isna(val):
        return np.nan
    val_str = str(val).strip()
    match = re.search(r"(\d+)\+(\d+)", val_str)
    if match:
        km = int(match.group(1))
        m  = int(match.group(2))
        return round(km + m / 1000, 3)
    return np.nan


def extract_hour(val) -> float:
    """
    Parse time strings into 24-hour integer hour.
    Handles: '14:30', '2:30 PM', '1430', '14.30' etc.
    Mirrors the notebook extract_hour() function.
    """
    if pd.isna(val):
        return np.nan
    val_str = str(val).strip().upper()
    match = re.search(r"(\d{1,2})[:\.]?(\d{0,2})\s*(AM|PM)?", val_str)
    if match:
        hour = int(match.group(1))
        ampm = match.group(3)
        if ampm == "PM" and hour != 12:
            hour += 12
        if ampm == "AM" and hour == 12:
            hour = 0
        return hour if 0 <= hour <= 23 else np.nan
    return np.nan


def time_of_day(hour) -> str:
    """
    Bucket hour into time-of-day label. Mirrors notebook exactly.
    """
    if pd.isna(hour):
        return "Unknown"
    hour = int(hour)
    if  6 <= hour < 12: return "Morning"
    if 12 <= hour < 17: return "Afternoon"
    if 17 <= hour < 21: return "Evening"
    if 21 <= hour < 24: return "Night"
    return "Late Night"  # 0–5


def get_season(month) -> str:
    """
    Map month number to Indian meteorological season.
    Mirrors notebook exactly.
    """
    if pd.isna(month):
        return "Unknown"
    month = int(month)
    if month in [12, 1, 2]:   return "Winter"
    if month in [3, 4, 5]:    return "Summer"
    if month in [6, 7, 8, 9]: return "Monsoon"
    return "Post-Monsoon"     # 10, 11


def severity_label(score: float) -> str:
    """
    Convert numeric severity score to label.
    Mirrors notebook severity_label() function.
    """
    if score == 0:  return "No Casualty"
    if score <= 2:  return "Low"
    if score <= 5:  return "Medium"
    if score <= 10: return "High"
    return "Critical"


# ════════════════════════════════════════════════════════════════
# STAGE 2 — FEATURE ENGINEERING (MAIN FUNCTION)
# ════════════════════════════════════════════════════════════════

def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Full Stage 2 feature engineering pipeline.

    Steps (matching notebook exactly):
      2.4  Extract chainage_km from location_chainage
      2.5  Datetime features: year, month, day, weekday, is_weekend,
           hour, time_of_day, season
      2.6  IRC-weighted severity_score
      2.7  severity_label
      2.8  500m and 1km segment bucketing
    """
    logger.info("=== Stage 2: Feature Engineering ===")

    # ── 2.4 Chainage KM ─────────────────────────────────────────
    if "location_chainage" in df.columns:
        df["chainage_km"] = df["location_chainage"].apply(extract_chainage_km)
        valid = df["chainage_km"].notna().sum()
        logger.info(
            f"chainage_km extracted — valid: {valid}/{len(df)}, "
            f"range: {df['chainage_km'].min():.2f} → "
            f"{df['chainage_km'].max():.2f} km"
        )
    else:
        logger.warning("'location_chainage' column not found — chainage_km will be null")
        df["chainage_km"] = np.nan

    # ── 2.5 Datetime features ────────────────────────────────────
    df["date"]       = pd.to_datetime(df["date"], errors="coerce")
    df["year"]       = df["date"].dt.year
    df["month"]      = df["date"].dt.month
    df["day"]        = df["date"].dt.day
    df["weekday"]    = df["date"].dt.day_name()
    df["is_weekend"] = df["date"].dt.weekday >= 5

    if "time" in df.columns:
        df["hour"] = df["time"].apply(extract_hour)
    else:
        df["hour"] = np.nan

    df["time_of_day"] = df["hour"].apply(time_of_day)
    df["season"]      = df["month"].apply(get_season)

    logger.info(
        f"Datetime features added — "
        f"years: {df['year'].dropna().unique().tolist()}"
    )

    # ── 2.6 IRC-weighted Severity Score ─────────────────────────
    # IRC:SP:88 weights — Fatal=5, Grievous=3, Minor=1, Non-injured=0
    fatal_w    = settings.IRC_FATAL_WEIGHT
    grievous_w = settings.IRC_GRIEVOUS_WEIGHT
    minor_w    = settings.IRC_MINOR_WEIGHT

    for col in ["fatal", "grievous", "minor", "non_injured"]:
        if col not in df.columns:
            df[col] = 0
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0).astype(int)

    df["severity_score"] = (
        df["fatal"]   * fatal_w +
        df["grievous"]* grievous_w +
        df["minor"]   * minor_w
    )
    logger.info(
        f"Severity score computed — "
        f"mean={df['severity_score'].mean():.2f}, "
        f"max={df['severity_score'].max()}"
    )

    # ── 2.7 Severity Label ───────────────────────────────────────
    df["severity_label"] = df["severity_score"].apply(severity_label)

    # ── 2.8 500m Segment bucketing ───────────────────────────────
    df["segment_500m"] = (df["chainage_km"] // 0.5) * 0.5
    df["segment_1km"]  = df["chainage_km"].apply(
        lambda x: int(x) if not pd.isna(x) else np.nan
    )

    valid_segs = df["segment_500m"].notna().sum()
    logger.success(
        f"Feature engineering complete — "
        f"{df.shape[1]} columns, {valid_segs} rows with valid segments"
    )
    return df


def preprocess(df: pd.DataFrame) -> pd.DataFrame:
    """
    Master preprocessing pipeline: clean + engineer features.
    This is the function called by pipeline.py.
    """
    df = clean_data(df)
    df = engineer_features(df)
    return df
