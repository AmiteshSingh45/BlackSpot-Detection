"""
db_patch_v2.py
──────────────
Schema migration for the Decision Support System upgrade.

Adds 8 new columns across 3 tables:
  uploads    → upload_label, upload_year, upload_source
  blackspots → confidence_score
  alerts     → priority_score

Safe to run multiple times — uses IF NOT EXISTS on every ALTER.

Usage:
    cd backend
    python db_patch_v2.py
"""

import os
import sys
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/demodb")

MIGRATIONS = [
    # ── uploads: metadata tagging ─────────────────────────────────────────
    "ALTER TABLE uploads ADD COLUMN IF NOT EXISTS upload_label  VARCHAR(200)",
    "ALTER TABLE uploads ADD COLUMN IF NOT EXISTS upload_year   INTEGER",
    "ALTER TABLE uploads ADD COLUMN IF NOT EXISTS upload_source VARCHAR(100)",

    # ── blackspots: ML confidence score ───────────────────────────────────
    "ALTER TABLE blackspots ADD COLUMN IF NOT EXISTS confidence_score FLOAT",

    # ── alerts: priority score ─────────────────────────────────────────────
    "ALTER TABLE alerts ADD COLUMN IF NOT EXISTS priority_score FLOAT",
]

def run():
    engine = create_engine(DATABASE_URL)
    print(f"Connecting to: {DATABASE_URL.split('@')[-1]}")  # hide credentials

    with engine.begin() as conn:
        for i, sql in enumerate(MIGRATIONS, 1):
            try:
                conn.execute(text(sql))
                table = sql.split("TABLE")[1].split("ADD")[0].strip()
                col   = sql.split("COLUMN IF NOT EXISTS")[1].split()[0].strip()
                print(f"  [{i}/{len(MIGRATIONS)}] OK  {table}.{col}")
            except Exception as e:
                print(f"  [{i}/{len(MIGRATIONS)}] WARN  {sql[:60]}... -> {e}")

    print(f"\nMigration complete -- {len(MIGRATIONS)} statements executed.")


if __name__ == "__main__":
    run()
