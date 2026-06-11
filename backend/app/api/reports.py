"""PDF report endpoint."""

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlmodel import Session

from app.core.db import get_session
from app.services.report import _period_label, generate_pdf

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/pdf")
def download_pdf(
    year: int,
    month: int | None = None,
    session: Session = Depends(get_session),
) -> StreamingResponse:
    pdf_bytes = generate_pdf(session, year, month)
    filename = f"finapp-informe-{_period_label(year, month).lower().replace(' ', '-')}.pdf"
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
