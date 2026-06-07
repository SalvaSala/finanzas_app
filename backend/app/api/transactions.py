"""CRUD endpoints for transactions."""

from fastapi import APIRouter, Depends, Query, status
from sqlmodel import Session

from app.core.db import get_session
from app.models import Transaction
from app.schemas import TransactionCreate, TransactionRead, TransactionUpdate
from app.services import transaction as transaction_service
from app.services.periods import period_range

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.get("", response_model=list[TransactionRead])
def list_transactions(
    year: int | None = Query(default=None),
    month: int | None = Query(default=None, ge=1, le=12),
    limit: int | None = Query(default=None, ge=1),
    session: Session = Depends(get_session),
) -> list[Transaction]:
    start = end = None
    if year is not None:
        start, end = period_range(year, month)
    return transaction_service.list_transactions(session, start, end, limit)


@router.post("", response_model=TransactionRead, status_code=status.HTTP_201_CREATED)
def create_transaction(
    data: TransactionCreate, session: Session = Depends(get_session)
) -> Transaction:
    return transaction_service.create_transaction(session, data)


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
