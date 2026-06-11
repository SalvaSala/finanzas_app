"""Backup and restore endpoints."""

import datetime as dt

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import Response
from sqlmodel import Session

from app.core.db import get_session
from app.services import backup as svc
from app.services.exceptions import ValidationError

router = APIRouter(prefix="/backup", tags=["backup"])


@router.get("")
def download_backup() -> Response:
    try:
        data = svc.create_backup()
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    filename = f"finapp-backup-{stamp}.db"
    return Response(
        content=data,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/restore", status_code=200)
async def restore_backup(
    file: UploadFile,
    session: Session = Depends(get_session),
) -> dict[str, str]:
    data = await file.read()
    if not data:
        raise HTTPException(status_code=422, detail="El archivo está vacío.")
    try:
        svc.restore_backup(data)
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    return {"status": "ok", "message": "Copia de seguridad restaurada correctamente."}
