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
    UploadFile, BackgroundTasks, status, Body
)
from sqlalchemy.orm import Session
from loguru import logger
from pydantic import BaseModel

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


# ════════════════════════════════════════════════════════════════
# DELETE /uploads/{upload_id}  — Delete upload & cascaded data
# ════════════════════════════════════════════════════════════════

@router.delete(
    "/{upload_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an upload and all associated records",
    description="Completely purges an upload alongside any connected pipeline analytical records."
)
def delete_upload(upload_id: int, db: Session = Depends(get_db)):
    upload = db.get(Upload, upload_id)
    if not upload:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Upload with id={upload_id} not found",
        )

    # Clean local file
    file_path = Path(settings.UPLOAD_DIR) / upload.filename
    if file_path.exists() and file_path.is_file():
        try:
            file_path.unlink()
            logger.info(f"Deleted physical file: {file_path}")
        except Exception as e:
            logger.warning(f"Failed to delete physical file {file_path}: {e}")

    # Manual cascade deletion to guarantee referential cleanup of aggregated data
    try:
        from app.models import Accident, Segment, Blackspot, Alert, Recommendation
        
        # Keep track of counts for logging
        r_deleted = db.query(Recommendation).filter(Recommendation.upload_id == upload_id).delete(synchronize_session=False)
        a_deleted = db.query(Alert).filter(Alert.upload_id == upload_id).delete(synchronize_session=False)
        b_deleted = db.query(Blackspot).filter(Blackspot.upload_id == upload_id).delete(synchronize_session=False)
        s_deleted = db.query(Segment).filter(Segment.upload_id == upload_id).delete(synchronize_session=False)
        acc_deleted = db.query(Accident).filter(Accident.upload_id == upload_id).delete(synchronize_session=False)
        
        db.delete(upload)
        db.commit()
        logger.info(f"Successfully purged Upload id={upload_id}. Deleted: {acc_deleted} accidents, {s_deleted} segments, {b_deleted} blackspots, {a_deleted} alerts, {r_deleted} recommendations.")
    except Exception as e:
        db.rollback()
        logger.error(f"Failed deleting Upload id={upload_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to thoroughly purge database records."
        )


# ════════════════════════════════════════════════════════════════
# PATCH /uploads/{upload_id}/label  — Tag an upload with metadata
# ════════════════════════════════════════════════════════════════

class UploadLabelBody(BaseModel):
    upload_label:  str  | None = None   # e.g. "NH-48 · 2022 Annual Data"
    upload_year:   int  | None = None   # e.g. 2022
    upload_source: str  | None = None   # e.g. "NHAI"


@router.patch(
    "/{upload_id}/label",
    response_model=UploadResponse,
    summary="Set metadata label on an upload",
    description=(
        "Allows users to tag an upload with a human-readable label, "
        "summary year, and data source. Used in the comparison UI and PDF reports."
    ),
)
def label_upload(
    upload_id: int,
    body: UploadLabelBody,
    db: Session = Depends(get_db),
):
    upload = db.get(Upload, upload_id)
    if not upload:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Upload with id={upload_id} not found",
        )
    if body.upload_label  is not None: upload.upload_label  = body.upload_label
    if body.upload_year   is not None: upload.upload_year   = body.upload_year
    if body.upload_source is not None: upload.upload_source = body.upload_source
    db.commit()
    db.refresh(upload)
    logger.info(f"Upload {upload_id} labelled: '{upload.upload_label}'")
    return upload

