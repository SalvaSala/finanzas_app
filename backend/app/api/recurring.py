"""CRUD endpoints for recurring transactions, plus a manual run trigger."""

from fastapi import APIRouter, Depends, status
from sqlmodel import Session

from app.core.db import get_session
from app.models.recurring import RecurringTransaction
from app.schemas.recurring import (
    RecurringCreate,
    RecurringRead,
    RecurringRunResult,
    RecurringUpdate,
)
from app.services import recurring as recurring_service

router = APIRouter(prefix="/recurring", tags=["recurring"])


@router.get("", response_model=list[RecurringRead])
def list_recurring(session: Session = Depends(get_session)) -> list[RecurringTransaction]:
    return recurring_service.list_recurring(session)


@router.post("", response_model=RecurringRead, status_code=status.HTTP_201_CREATED)
def create_recurring(
    data: RecurringCreate, session: Session = Depends(get_session)
) -> RecurringTransaction:
    return recurring_service.create_recurring(session, data)


# NOTE: /run must be declared BEFORE /{recurring_id} so FastAPI does not treat
# the literal string as an integer path param.


@router.post("/run", response_model=RecurringRunResult)
def run_recurring(session: Session = Depends(get_session)) -> RecurringRunResult:
    generated = recurring_service.run_due(session)
    return RecurringRunResult(generated=generated)


@router.get("/{recurring_id}", response_model=RecurringRead)
def get_recurring(
    recurring_id: int, session: Session = Depends(get_session)
) -> RecurringTransaction:
    return recurring_service.get_recurring(session, recurring_id)


@router.patch("/{recurring_id}", response_model=RecurringRead)
def update_recurring(
    recurring_id: int,
    data: RecurringUpdate,
    session: Session = Depends(get_session),
) -> RecurringTransaction:
    return recurring_service.update_recurring(session, recurring_id, data)


@router.delete("/{recurring_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recurring(recurring_id: int, session: Session = Depends(get_session)) -> None:
    recurring_service.delete_recurring(session, recurring_id)
