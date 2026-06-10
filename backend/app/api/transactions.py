"""CRUD endpoints for transactions, plus CSV export/import."""

import datetime as dt

from fastapi import APIRouter, Depends, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlmodel import Session

from app.core.db import get_session
from app.models import Transaction
from app.models.enums import TransactionType
from app.schemas import TransactionCreate, TransactionRead, TransactionUpdate
from app.schemas.tag import TagRead
from app.schemas.transaction import ImportResult
from app.services import csv_io
from app.services import tag as tag_service
from app.services import transaction as transaction_service
from app.services.periods import period_range

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.get("", response_model=list[TransactionRead])
def list_transactions(
    year: int | None = Query(default=None),
    month: int | None = Query(default=None, ge=1, le=12),
    limit: int | None = Query(default=None, ge=1),
    type: TransactionType | None = Query(default=None),
    category_id: int | None = Query(default=None),
    account_id: int | None = Query(default=None),
    tag_id: int | None = Query(default=None),
    search: str | None = Query(default=None, max_length=200),
    session: Session = Depends(get_session),
) -> list[Transaction]:
    start = end = None
    if year is not None:
        start, end = period_range(year, month)
    return transaction_service.list_transactions(
        session,
        start,
        end,
        limit,
        transaction_type=type,
        category_id=category_id,
        account_id=account_id,
        search=search,
        tag_id=tag_id,
    )


@router.post("", response_model=TransactionRead, status_code=status.HTTP_201_CREATED)
def create_transaction(
    data: TransactionCreate, session: Session = Depends(get_session)
) -> Transaction:
    return transaction_service.create_transaction(session, data)


# NOTE: /export and /import-csv must be declared BEFORE /{transaction_id}
# so FastAPI does not treat the literal strings as integer path params.


@router.get("/export")
def export_transactions(
    year: int | None = Query(default=None),
    month: int | None = Query(default=None, ge=1, le=12),
    type: TransactionType | None = Query(default=None),
    category_id: int | None = Query(default=None),
    account_id: int | None = Query(default=None),
    search: str | None = Query(default=None, max_length=200),
    session: Session = Depends(get_session),
) -> StreamingResponse:
    start = end = None
    if year is not None:
        start, end = period_range(year, month)
    transactions = transaction_service.list_transactions(
        session,
        start,
        end,
        transaction_type=type,
        category_id=category_id,
        account_id=account_id,
        search=search,
    )
    csv_content = csv_io.export_csv(session, transactions)
    today = dt.date.today().isoformat()
    filename = f"movimientos_{today}.csv"
    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/import-csv", response_model=ImportResult)
async def import_transactions(
    file: UploadFile,
    session: Session = Depends(get_session),
) -> ImportResult:
    raw = await file.read()
    try:
        content = raw.decode("utf-8")
    except UnicodeDecodeError:
        content = raw.decode("latin-1")
    result = csv_io.import_csv(session, content)
    return ImportResult(**result.to_dict())


@router.get("/{transaction_id}/tags", response_model=list[TagRead])
def list_transaction_tags(
    transaction_id: int, session: Session = Depends(get_session)
) -> list[TagRead]:
    tx = transaction_service.get_transaction(session, transaction_id)
    return tx.tags  # type: ignore[return-value]


@router.post(
    "/{transaction_id}/tags/{tag_id}",
    response_model=TransactionRead,
    status_code=status.HTTP_200_OK,
)
def attach_tag(
    transaction_id: int, tag_id: int, session: Session = Depends(get_session)
) -> Transaction:
    return tag_service.attach_tag(session, transaction_id, tag_id)


@router.delete(
    "/{transaction_id}/tags/{tag_id}",
    response_model=TransactionRead,
    status_code=status.HTTP_200_OK,
)
def detach_tag(
    transaction_id: int, tag_id: int, session: Session = Depends(get_session)
) -> Transaction:
    return tag_service.detach_tag(session, transaction_id, tag_id)


@router.put("/{transaction_id}/tags", response_model=TransactionRead)
def set_tags(
    transaction_id: int,
    tag_ids: list[int],
    session: Session = Depends(get_session),
) -> Transaction:
    return tag_service.set_tags(session, transaction_id, tag_ids)


@router.get("/{transaction_id}", response_model=TransactionRead)
def get_transaction(transaction_id: int, session: Session = Depends(get_session)) -> Transaction:
    return transaction_service.get_transaction(session, transaction_id)


@router.patch("/{transaction_id}", response_model=TransactionRead)
def update_transaction(
    transaction_id: int,
    data: TransactionUpdate,
    session: Session = Depends(get_session),
) -> Transaction:
    return transaction_service.update_transaction(session, transaction_id, data)


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(transaction_id: int, session: Session = Depends(get_session)) -> None:
    transaction_service.delete_transaction(session, transaction_id)
