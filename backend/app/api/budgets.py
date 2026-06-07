"""CRUD + progress endpoints for budgets."""

from fastapi import APIRouter, Depends, Query, status
from sqlmodel import Session

from app.core.db import get_session
from app.models.budget import Budget
from app.schemas.budget import BudgetCreate, BudgetProgress, BudgetRead, BudgetUpdate
from app.services import budget as budget_service

router = APIRouter(prefix="/budgets", tags=["budgets"])


@router.get("", response_model=list[BudgetRead])
def list_budgets(session: Session = Depends(get_session)) -> list[Budget]:
    return budget_service.list_budgets(session)


@router.post("", response_model=BudgetRead, status_code=status.HTTP_201_CREATED)
def create_budget(data: BudgetCreate, session: Session = Depends(get_session)) -> Budget:
    return budget_service.create_budget(session, data)


@router.get("/progress", response_model=list[BudgetProgress])
def get_progress(
    year: int = Query(...),
    month: int | None = Query(default=None, ge=1, le=12),
    session: Session = Depends(get_session),
) -> list[BudgetProgress]:
    return budget_service.get_progress(session, year, month)


@router.get("/{budget_id}", response_model=BudgetRead)
def get_budget(budget_id: int, session: Session = Depends(get_session)) -> Budget:
    return budget_service.get_budget(session, budget_id)


@router.patch("/{budget_id}", response_model=BudgetRead)
def update_budget(
    budget_id: int, data: BudgetUpdate, session: Session = Depends(get_session)
) -> Budget:
    return budget_service.update_budget(session, budget_id, data)


@router.delete("/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_budget(budget_id: int, session: Session = Depends(get_session)) -> None:
    budget_service.delete_budget(session, budget_id)
