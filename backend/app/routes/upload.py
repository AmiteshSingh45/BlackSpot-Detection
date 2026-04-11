"""
app/routes/upload.py
─────────────────────
Upload endpoints — file ingestion + auto-trigger pipeline.

Routes:
  POST /upload              — Upload Excel/CSV/JSON → triggers pipeline
  GET  /uploads             — List all uploads + status
  GET  /uploads/{upload_id} — Single upload detail
  POST /uploads/{upload_id}/run — Manually re-trigger pipeline
"""

import os
import shutil
from datetime import datetime, timezone
from pathlib import Path

from fastapi import (
    APIRouter, Depends, File, HTTPException,
    UploadFile, BackgroundTasks, status
)
from sqlalchemy.orm import Session
from loguru import logger

from app.database import get_db
from app.models import Upload
from app.schemas import (
    UploadResponse, UploadListResponse, PipelineTriggerResponse
)
from app.config import settings
from src.pipeline import run_pipeline

router = APIRouter(prefix="/uploads", tags=["Upload"])

# ── Allowed file extensions ──────────────────────────────────────
ALLOWED_EXTENSIONS = {".xlsx", ".xls", ".csv", ".json"}


# ════════════════════════════════════════════════════════════════
# BACKGROUND TASK WRAPPER
# ════════════════════════════════════════════════════════════════

def _run_pipeline_background(file_path: str, upload_id: int):
    """
    Wrapper to run the pipeline in a FastAPI BackgroundTask.
    Creates its own DB session since the request session will be closed.
    """
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        run_pipeline(file_path, upload_id, db)
    except Exception as e:
        logger.error(f"Background pipeline failed for upload {upload_id}: {e}")
    finally:
        db.close()


# ════════════════════════════════════════════════════════════════
# POST /upload  — Main upload endpoint
# ════════════════════════════════════════════════════════════════

@router.post(
    "",
    response_model=PipelineTriggerResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Upload accident data file",
    description=(
        "Upload an Excel (.xlsx), CSV (.csv) or JSON (.json) file "
        "containing road accident records. The pipeline (all 5 stages) "
        "will automatically trigger in the background."
    ),
)
async def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    # ── Validate file type ───────────────────────────────────────
    filename = file.filename or ""
    ext = Path(filename).suffix.lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Unsupported file type '{ext}'. "
                f"Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
            ),
        )

    # ── Validate file size ───────────────────────────────────────
    content = await file.read()
    if len(content) > settings.max_file_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum size of {settings.MAX_FILE_SIZE_MB} MB",
        )

    # ── Save file to upload directory ────────────────────────────
    settings.ensure_upload_dir()
    timestamp  = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    safe_name  = f"{timestamp}_{filename}"
    save_path  = Path(settings.UPLOAD_DIR) / safe_name

    with open(save_path, "wb") as f:
        f.write(content)

    logger.info(f"File saved: {save_path} ({len(content)/1024:.1f} KB)")

    # ── Create Upload record in DB ───────────────────────────────
    upload_record = Upload(
        filename          = safe_name,
        original_filename = filename,
        file_type         = ext.lstrip("."),
        status            = "pending",
    )
    db.add(upload_record)
    db.commit()
    db.refresh(upload_record)

    upload_id = upload_record.id
    logger.info(f"Upload record created: id={upload_id}")

    # ── Trigger pipeline in background ──────────────────────────
    background_tasks.add_task(
        _run_pipeline_background,
        str(save_path.resolve()),
        upload_id,
    )

    return PipelineTriggerResponse(
        message   = (
            f"File '{filename}' uploaded successfully. "
            f"Pipeline is running in the background."
        ),
        upload_id = upload_id,
        status    = "processing",
    )


# ════════════════════════════════════════════════════════════════
# GET /uploads  — List all uploads
# ════════════════════════════════════════════════════════════════

@router.get(
    "",
    response_model=UploadListResponse,
    summary="List all uploads",
)
def list_uploads(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
):
    uploads = (
        db.query(Upload)
        .order_by(Upload.uploaded_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    total = db.query(Upload).count()
    return UploadListResponse(total=total, uploads=uploads)


# ════════════════════════════════════════════════════════════════
# GET /uploads/{upload_id}  — Single upload detail
# ════════════════════════════════════════════════════════════════

@router.get(
    "/{upload_id}",
    response_model=UploadResponse,
    summary="Get upload detail",
)
def get_upload(upload_id: int, db: Session = Depends(get_db)):
    upload = db.get(Upload, upload_id)
    if not upload:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Upload with id={upload_id} not found",
        )
    return upload


# ════════════════════════════════════════════════════════════════
# POST /uploads/{upload_id}/run  — Re-trigger pipeline
# ════════════════════════════════════════════════════════════════

@router.post(
    "/{upload_id}/run",
    response_model=PipelineTriggerResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Re-run pipeline for an existing upload",
)
def rerun_pipeline(
    upload_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    upload = db.get(Upload, upload_id)
    if not upload:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Upload with id={upload_id} not found",
        )

    file_path = Path(settings.UPLOAD_DIR) / upload.filename
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Original file not found on disk: {upload.filename}",
        )

    # Reset status
    upload.status        = "pending"
    upload.error_message = None
    db.commit()

    background_tasks.add_task(
        _run_pipeline_background,
        str(file_path.resolve()),
        upload_id,
    )

    return PipelineTriggerResponse(
        message   = f"Pipeline re-triggered for upload id={upload_id}",
        upload_id = upload_id,
        status    = "processing",
    )
