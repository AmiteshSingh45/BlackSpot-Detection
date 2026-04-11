"""
src/data_ingestion.py
─────────────────────
Stage 1 — Smart Data Loading & Ingestion.

Handles the raw Excel format used by NH-48 accident data:
  • Multi-row header (variable depth)
  • Coded categorical columns (A=nature, B=classification, etc.)
  • Numeric codes for nature/classification/causes/weather/etc.
  • Combines sub-columns (fatal/grievous/minor) hidden as unnamed columns

Flow:
  1. Detect header row (finds 'Sr. No.' or similar)
  2. Skip sub-header rows
  3. Assign standard column names
  4. Decode numeric codes → readable labels
  5. Return clean DataFrame ready for preprocessing
"""

import json
import numpy as np
import pandas as pd
from pathlib import Path
from loguru import logger
from typing import Union, Optional


# ════════════════════════════════════════════════════════════════
# STANDARD COLUMN SCHEMA
# ════════════════════════════════════════════════════════════════

# Full 22-column schema (older Excel files that include 'side' column)
STANDARD_COLUMNS_FULL = [
    'sr_no', 'date', 'time', 'side', 'location_chainage',
    'accident_location', 'nature', 'classification',
    'causes', 'road_features', 'road_condition',
    'intersection', 'weather',
    'vehicle_reg', 'vehicle_type',
    'fatal', 'grievous', 'minor', 'non_injured',
    'animals_killed', 'help', 'remarks'
]

# 21-column schema (newer files where chainage is directly at col 3, no separate 'side')
STANDARD_COLUMNS_NO_SIDE = [
    'sr_no', 'date', 'time', 'location_chainage',
    'accident_location', 'nature', 'classification',
    'causes', 'road_features', 'road_condition',
    'intersection', 'weather',
    'vehicle_reg', 'vehicle_type',
    'fatal', 'grievous', 'minor', 'non_injured',
    'animals_killed', 'help', 'remarks'
]

# Default (used for auto-selection)
STANDARD_COLUMNS = STANDARD_COLUMNS_FULL

# ── Required columns that MUST exist after loading ──────────────
REQUIRED_COLUMNS = [
    "date", "fatal", "grievous", "minor", "non_injured", "location_chainage"
]

# ── Columns we expect but treat as optional ─────────────────────
OPTIONAL_COLUMNS = [
    "sr_no", "time", "accident_location", "nature", "classification",
    "causes", "road_features", "road_condition", "intersection",
    "weather", "vehicle_type", "source_file", "remarks", "animals_killed"
]


# ════════════════════════════════════════════════════════════════
# NUMERIC CODE MAPPINGS  (from actual Excel legend)
# ════════════════════════════════════════════════════════════════

MAP_NATURE = {
    1: "Head on collision",
    2: "Side swipe collision",
    3: "Roll Over",
    4: "Rear End Collision",
    5: "Collision with stationary object",
    6: "Hit to run",
    7: "Collision",
    8: "Others",
}

MAP_CLASSIFICATION = {
    1: "Fatal",
    2: "Grievous Injury",
    3: "Minor Injury",
    4: "Non Injury",
}

MAP_CAUSES = {
    1: "Drunken",
    2: "Overspeeding",
    3: "Vehicle out of control",
    4: "Driver fault",
    5: "Mechanical/Road defect",
}

MAP_ROAD_FEATURES = {
    1: "Single lane",
    2: "Two lanes",
    3: "3+ no divider",
    4: "4+ divider",
}

MAP_ROAD_CONDITION = {
    1: "Straight",
    2: "Slight curve",
    3: "Sharp curve",
    4: "Flat",
    5: "Gentle incline",
    6: "Steep incline",
    7: "Hump",
    8: "Dip",
}

MAP_INTERSECTION = {
    1: "T junction",
    2: "Y junction",
    3: "Four arm junction",
    4: "Staggered junction",
    5: "Multi arm junction",
    6: "Roundabout",
    7: "Rail crossing manned",
    9: "Rail crossing unmanned",
}

MAP_WEATHER = {
    1:  "Fine",
    2:  "Mist/Fog",
    3:  "Cloudy",
    4:  "Light rain",
    5:  "Heavy rain",
    6:  "Hail/Sleet",
    7:  "Snow",
    8:  "Strong wind",
    9:  "Dust storm",
    10: "Very hot",
    11: "Very cold",
    12: "Other",
}

MAP_VEHICLE = {
    1: "Car",
    2: "SUV",
    3: "Bus",
    4: "Minibus",
    5: "Truck",
    6: "2 Wheeler",
    7: "3 Wheeler",
    8: "Cycle",
    9: "Pedestrian",
}

MAP_ACCIDENT_LOCATION = {
    1: "Urban",
    2: "Rural",
    3: "Semi-urban",
    4: "Industrial",
    5: "Agricultural",
    6: "Forest",
    7: "Hilly",
    8: "Coastal",
    9: "Other",
}

# Column name → decoding map
COLUMN_MAPPINGS = {
    'accident_location': MAP_ACCIDENT_LOCATION,
    'nature':            MAP_NATURE,
    'classification':    MAP_CLASSIFICATION,
    'causes':            MAP_CAUSES,
    'road_features':     MAP_ROAD_FEATURES,
    'road_condition':    MAP_ROAD_CONDITION,
    'intersection':      MAP_INTERSECTION,
    'weather':           MAP_WEATHER,
    'vehicle_type':      MAP_VEHICLE,
}


# ════════════════════════════════════════════════════════════════
# ALIAS MAP — for pre-combined/CSV files that already have headers
# ════════════════════════════════════════════════════════════════

COLUMN_ALIASES: dict = {
    # date variants
    "date_of_accident":          "date",
    "accident_date":             "date",
    "date_ddmmyy":               "date",
    "date_accident":             "date",
    # time variants
    "time_of_accident":          "time",
    "time_of_accident_am_pm":    "time",
    "accident_time":             "time",
    # chainage variants
    "chainage":                  "location_chainage",
    "location_chainage_km":      "location_chainage",
    "locationchainage":          "location_chainage",
    "loc_chainage":              "location_chainage",
    # sr_no variants
    "srno":                      "sr_no",
    "serial_no":                 "sr_no",
    "sno":                       "sr_no",
    "s_no":                      "sr_no",
    # casualty variants
    "fatalities":                "fatal",
    "fatal_accidents":           "fatal",
    "no_of_fatal":               "fatal",
    "grievously_injured":        "grievous",
    "grievous_injuries":         "grievous",
    "no_of_grievous":            "grievous",
    "minor_injuries":            "minor",
    "no_of_minor":               "minor",
    "non_injured_persons":       "non_injured",
    "non_injury":                "non_injured",
    # coded column aliases (single-letter columns from raw Excel)
    "a":                         "accident_location",
    "b":                         "nature",
    "c":                         "classification",
    "d":                         "causes",
    "e":                         "road_features",
    "f":                         "road_condition",
    "g":                         "intersection",
    "h":                         "weather",
    "i":                         "vehicle_reg",    # vehicle reg number col
    # vehicle type may appear as j or similar
    # other common renames
    "type_of_accident":          "classification",
    "accident_type":             "classification",
    "nature_of_accident":        "nature",
    "cause":                     "causes",
    "cause_of_accident":         "causes",
    "vehicle":                   "vehicle_type",
    "type_of_vehicle":           "vehicle_type",
    "location":                  "accident_location",
    "animals_killed":            "animals_killed",
    "no_of_animals_killed_if_any":  "animals_killed",
    "help_provided_by_ambulances_patrolling_vehicle": "help",
}


# ════════════════════════════════════════════════════════════════
# HELPERS
# ════════════════════════════════════════════════════════════════

def _apply_mapping(value, mapping: dict) -> str:
    """
    Decode a numeric code (or comma-separated codes) using a mapping dict.
    Mirrors the notebook's apply_mapping() exactly.
    """
    if pd.isna(value):
        return "Unknown"
    val_str = str(value).strip()
    if val_str in ("-", "", "nan", "None", "0.0", "0"):
        return "Unknown"

    parts = [p.strip() for p in val_str.split(",")]
    results = []
    for part in parts:
        if part in ("-", "", "nan", "None"):
            continue
        try:
            key = int(float(part))
            results.append(mapping.get(key, f"Unknown({key})"))
        except (ValueError, TypeError):
            results.append(part)  # already a string, keep as-is

    return ", ".join(results) if results else "Unknown"


def _decode_numeric_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Decode all numeric-coded categorical columns using the mapping tables.
    """
    for col, mapping in COLUMN_MAPPINGS.items():
        if col in df.columns:
            df[col] = df[col].apply(lambda x: _apply_mapping(x, mapping))
            logger.debug(f"  Decoded {col}: {df[col].value_counts().head(3).to_dict()}")
    return df


def _canonicalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Normalize column names and apply alias remapping.
    Handles: special characters, whitespace, common Excel header variants,
    and single-letter coded columns (a→accident_location, b→nature, etc.)
    """
    # Step 1: strip, lowercase, replace whitespace/hyphens/slashes → _
    df.columns = (
        df.columns
        .str.strip()
        .str.lower()
        .str.replace(r"[\s\-/\\]+", "_", regex=True)   # whitespace → _
        .str.replace(r"[^a-z0-9_]", "", regex=True)    # remove non-alphanumeric
        .str.strip("_")                                  # remove leading/trailing _
    )

    # Step 2: apply alias map
    df.rename(columns=lambda c: COLUMN_ALIASES.get(c, c), inplace=True)

    # Step 3: deduplicate columns (keep first occurrence)
    df = df.loc[:, ~df.columns.duplicated()]

    return df


def _find_data_start(df_raw: pd.DataFrame) -> Optional[int]:
    """
    Find the row index where actual data begins by looking for
    'Sr. No.' or 'Sr', or 'S.No' in any cell of the row.
    Mirrors the notebook's find_data_start() function.

    Returns the row INDEX after which data starts (i.e., skip rows 0..return_val).
    """
    for i, row in df_raw.iterrows():
        row_vals = row.astype(str).str.lower().str.strip()
        if (row_vals.str.contains(r'\bsr\b', na=False, regex=True).any() or
                row_vals.str.contains(r'sr\.', na=False, regex=True).any() or
                row_vals.str.contains(r's\.no', na=False, regex=True).any() or
                row_vals.str.contains(r'serial', na=False, regex=True).any()):
            return i + 1  # data starts AFTER this row
    return None


# ════════════════════════════════════════════════════════════════
# RAW EXCEL LOADER (replicates Jupyter notebook logic exactly)
# ════════════════════════════════════════════════════════════════

def _load_raw_excel(file_path: Path) -> pd.DataFrame:
    """
    Smart loader for raw NH-48 Excel files with multi-row headers
    and coded columns. Mirrors the Jupyter notebook's load_excel_file().

    Steps:
      1. Read raw without headers
      2. Find header row (detect 'Sr. No.')
      3. Re-read skipping header rows + sub-header row
      4. Drop fully-empty rows and non-numeric sr_no rows
      5. Keep only the expected number of columns
      6. Assign standard column names (STANDARD_COLUMNS)
      7. Decode numeric-coded categoricals
    """
    logger.info(f"Loading raw NH-48 Excel: {file_path.name}")

    # Read raw to find where actual data starts
    df_raw = pd.read_excel(file_path, header=None, engine="openpyxl")
    logger.debug(f"Raw shape: {df_raw.shape}")

    start_row = _find_data_start(df_raw)

    if start_row is None:
        logger.warning(
            f"Could not find header row in {file_path.name}. "
            f"Attempting to use first row as header."
        )
        start_row = 0

    # Re-read skipping headers + one sub-header row (vehicle reg / vehicle type)
    # start_row is the actual column header row index, so skip start_row + 1 rows
    df = pd.read_excel(
        file_path,
        header=None,
        skiprows=start_row + 1,  # skip header + sub-header rows
        engine="openpyxl",
    )

    # Drop completely empty rows
    df.dropna(how="all", inplace=True)

    # Drop rows where sr_no (col 0) is not numeric — these are leftover sub-headers
    df = df[pd.to_numeric(df.iloc[:, 0], errors="coerce").notna()].copy()
    df.reset_index(drop=True, inplace=True)

    if df.empty:
        raise ValueError(f"No valid data rows found in {file_path.name}")

    logger.debug(f"After cleanup: {df.shape[0]} rows, {df.shape[1]} columns")

    # ── Auto-select column schema based on column count ───────────
    n_cols = len(df.columns)
    n_full    = len(STANDARD_COLUMNS_FULL)    # 22 (with 'side')
    n_no_side = len(STANDARD_COLUMNS_NO_SIDE) # 21 (without 'side')

    if n_cols >= n_full:
        # 22+ columns → full schema (includes 'side')
        df = df.iloc[:, :n_full]
        df.columns = STANDARD_COLUMNS_FULL
        logger.info(f"Schema: 22-column (with 'side')")
    elif n_cols >= n_no_side:
        # 21 columns → no-side schema
        df = df.iloc[:, :n_no_side]
        df.columns = STANDARD_COLUMNS_NO_SIDE
        logger.info(f"Schema: 21-column (without 'side')")
    elif n_cols > 0:
        # Fewer than 21 — try no-side schema, truncated
        df = df.iloc[:, :n_cols]
        df.columns = STANDARD_COLUMNS_NO_SIDE[:n_cols]
        logger.warning(
            f"{file_path.name} has only {n_cols} columns, expected {n_no_side}. "
            f"Some columns may be missing."
        )
    else:
        raise ValueError(f"No columns found in {file_path.name}")

    # ── Add source file for traceability ─────────────────────────
    df["source_file"] = file_path.name

    return df


# ════════════════════════════════════════════════════════════════
# PUBLIC LOADERS
# ════════════════════════════════════════════════════════════════

def load_from_excel(file_path: Union[str, Path]) -> pd.DataFrame:
    """
    Load an .xlsx or .xls file into a standardized DataFrame.

    Automatically detects whether the file is:
    - A RAW Excel file with multi-row headers and coded columns
       → Uses smart raw loader + column assignment + code decoding
    - A PRE-COMBINED file with proper column headers
       → Uses standard loader + alias remapping
    """
    file_path = Path(file_path)

    if not file_path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    # ── Try smart raw loader first ────────────────────────────────
    # This handles the native NH-48 Excel format used yearly
    try:
        df = _load_raw_excel(file_path)
        logger.info(f"Raw Excel loaded: {df.shape[0]} rows × {df.shape[1]} columns")

        # Convert date
        df["date"] = pd.to_datetime(df["date"], dayfirst=True, errors="coerce")

        # Convert numeric casualty columns
        numeric_cols = ["fatal", "grievous", "minor", "non_injured", "animals_killed"]
        for col in numeric_cols:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0).astype(int)

        # Strip string columns
        str_cols = ["side", "location_chainage", "vehicle_type", "remarks"]
        for col in str_cols:
            if col in df.columns:
                df[col] = df[col].astype(str).str.strip()

        # Decode numeric-coded categoricals
        df = _decode_numeric_columns(df)

        # Verify we got at least date and location_chainage
        if "date" in df.columns and df["date"].notna().sum() > 0:
            logger.success(
                f"Excel loaded (raw schema): {df.shape[0]} rows × {df.shape[1]} columns"
            )
            return df

    except Exception as e:
        logger.warning(f"Raw loader failed ({e}), falling back to standard loader...")

    # ── Fallback: standard load with header canonicalization ──────
    # This handles pre-combined CSV-like Excel files with proper headers
    df = pd.read_excel(file_path, engine="openpyxl")
    df = _canonicalize_columns(df)
    logger.success(
        f"Excel loaded (standard schema): {df.shape[0]} rows × {df.shape[1]} columns"
    )
    return df


def load_from_csv(file_path: Union[str, Path]) -> pd.DataFrame:
    """
    Load a .csv file into a DataFrame.
    Applies alias canonicalization for pre-combined CSVs.
    """
    file_path = Path(file_path)
    logger.info(f"Loading CSV file: {file_path.name}")

    if not file_path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    df = pd.read_csv(file_path, encoding="utf-8", low_memory=False)
    df = _canonicalize_columns(df)

    # Decode numeric-coded categoricals if still needed
    df = _decode_numeric_columns(df)

    logger.success(f"CSV loaded: {df.shape[0]} rows × {df.shape[1]} columns")
    return df


def load_from_json(data: Union[list, dict]) -> pd.DataFrame:
    """
    Load a JSON object (list of records or dict) into a DataFrame.
    """
    logger.info("Loading from JSON data")

    if isinstance(data, dict):
        data = data.get("data", data)

    df = pd.DataFrame(data)
    df = _canonicalize_columns(df)
    df = _decode_numeric_columns(df)
    logger.success(f"JSON loaded: {df.shape[0]} rows × {df.shape[1]} columns")
    return df


def load_file(file_path: Union[str, Path]) -> pd.DataFrame:
    """
    Auto-detect file type and load accordingly.
    Supported: .xlsx, .xls, .csv, .json
    """
    file_path = Path(file_path)
    ext = file_path.suffix.lower()

    if ext in (".xlsx", ".xls"):
        return load_from_excel(file_path)
    elif ext == ".csv":
        return load_from_csv(file_path)
    elif ext == ".json":
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return load_from_json(data)
    else:
        raise ValueError(
            f"Unsupported file type: '{ext}'. "
            f"Supported types: .xlsx, .xls, .csv, .json"
        )


# ════════════════════════════════════════════════════════════════
# VALIDATION
# ════════════════════════════════════════════════════════════════

def validate_required_columns(df: pd.DataFrame) -> dict:
    """
    Check that all required columns are present after loading.
    """
    present = [c for c in REQUIRED_COLUMNS if c in df.columns]
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]

    if missing:
        logger.warning(f"Missing required columns: {missing}")
    else:
        logger.success(f"All required columns present: {REQUIRED_COLUMNS}")

    return {
        "valid": len(missing) == 0,
        "missing": missing,
        "present": present,
        "all_columns": df.columns.tolist(),
    }


def audit_data(df: pd.DataFrame) -> dict:
    """
    Stage 1 — Data Profiling & Quality Audit.
    Returns a dict that can be serialized to JSON for the API.
    """
    logger.info("Running data quality audit (Stage 1)...")

    total_records  = df.shape[0]
    total_features = df.shape[1]

    # Date range
    date_min = date_max = None
    if "date" in df.columns:
        dates    = pd.to_datetime(df["date"], errors="coerce")
        date_min = str(dates.min()) if not dates.isna().all() else None
        date_max = str(dates.max()) if not dates.isna().all() else None

    # Source files
    source_files = []
    if "source_file" in df.columns:
        source_files = df["source_file"].dropna().unique().tolist()

    # Missing value analysis
    null_counts    = df.isnull().sum()
    unknown_counts = df.apply(lambda col: (col.astype(str) == "Unknown").sum())
    total_missing  = null_counts + unknown_counts

    missing_report = []
    for col in df.columns:
        missing_report.append({
            "column":        col,
            "dtype":         str(df[col].dtype),
            "nan_count":     int(null_counts[col]),
            "unknown_count": int(unknown_counts[col]),
            "total_missing": int(total_missing[col]),
            "missing_pct":   round(total_missing[col] / total_records * 100, 2),
        })
    missing_report.sort(key=lambda x: x["total_missing"], reverse=True)

    # Numeric stats
    numeric_cols = ["fatal", "grievous", "minor", "non_injured", "animals_killed"]
    numeric_cols = [c for c in numeric_cols if c in df.columns]
    numeric_stats = {}
    if numeric_cols:
        numeric_stats = df[numeric_cols].describe().round(2).to_dict()

    # Duplicate check
    dup_subset = [c for c in ["date", "time", "location_chainage"] if c in df.columns]
    duplicate_count = int(df.duplicated(subset=dup_subset).sum()) if dup_subset else 0

    audit_result = {
        "total_records":   total_records,
        "total_features":  total_features,
        "date_min":        date_min,
        "date_max":        date_max,
        "source_files":    source_files,
        "missing_report":  missing_report,
        "numeric_stats":   numeric_stats,
        "duplicate_count": duplicate_count,
    }

    logger.success(
        f"Audit complete — {total_records} records, "
        f"{duplicate_count} duplicates found"
    )
    return audit_result
