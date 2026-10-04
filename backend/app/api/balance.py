"""Available-balance endpoints: the KPI and its manual adjustments."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.core.db import get_session
from app.schemas.balance import (
    BalanceAdjustmentCreate,
    BalanceAdjustmentRead,
    BalanceSet,
    BalanceStatus,
)
from app.services import balance as service
from app.services.exceptions import NotFoundError

router = APIRouter(prefix="/balance", tags=["balance"])


@router.get("", response_model=BalanceStatus)
def get_balance(session: Session = Depends(get_session)) -> BalanceStatus:
    return service.get_status(session)


@router.put("", response_model=BalanceStatus)
def set_balance(data: BalanceSet, session: Session = Depends(get_session)) -> BalanceStatus:
    """Set the available balance; the difference is stored as an adjustment."""
    return service.set_available(session, data)


@router.get("/adjustments", response_model=list[BalanceAdjustmentRead])
def list_adjustments(session: Session = Depends(get_session)) -> list[BalanceAdjustmentRead]:
    return service.list_adjustments(session)


@router.post(
    "/adjustments",
    response_model=BalanceAdjustmentRead,
    status_code=status.HTTP_201_CREATED,
)
def create_adjustment(
    data: BalanceAdjustmentCreate, session: Session = Depends(get_session)
) -> BalanceAdjustmentRead:
    return service.create_adjustment(session, data)


@router.delete("/adjustments/{adjustment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_adjustment(adjustment_id: int, session: Session = Depends(get_session)) -> None:
    try:
        service.delete_adjustment(session, adjustment_id)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e
