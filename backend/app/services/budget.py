"""Business logic for budgets: CRUD and progress calculation."""

import datetime as dt

from sqlmodel import Session

from app.models.budget import Budget
from app.models.enums import BudgetPeriod, TransactionType
from app.repositories import budget as budget_repo
from app.repositories import category as category_repo
from app.repositories import transaction as transaction_repo
from app.schemas.budget import BudgetCreate, BudgetProgress, BudgetUpdate
from app.services.exceptions import NotFoundError, ValidationError
from app.services.periods import period_range


def create_budget(session: Session, data: BudgetCreate) -> Budget:
    if category_repo.get(session, data.category_id) is None:
        raise NotFoundError("La categoría indicada no existe.")
    if budget_repo.get_by_category(session, data.category_id) is not None:
        raise ValidationError("Ya existe un presupuesto para esta categoría.")
    budget = Budget(**data.model_dump())
    return budget_repo.create(session, budget)


def get_budget(session: Session, budget_id: int) -> Budget:
    budget = budget_repo.get(session, budget_id)
    if budget is None:
        raise NotFoundError("El presupuesto indicado no existe.")
    return budget


def list_budgets(session: Session) -> list[Budget]:
    return budget_repo.list_all(session)


def update_budget(session: Session, budget_id: int, data: BudgetUpdate) -> Budget:
    budget = get_budget(session, budget_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(budget, field, value)
    return budget_repo.update(session, budget)


def delete_budget(session: Session, budget_id: int) -> None:
    budget = get_budget(session, budget_id)
    budget_repo.delete(session, budget)


def get_progress(session: Session, year: int, month: int | None) -> list[BudgetProgress]:
    budgets = budget_repo.list_all(session)
    categories = {c.id: c for c in category_repo.list_all(session)}
    now = dt.date.today()

    result = []
    for budget in budgets:
        if budget.period == BudgetPeriod.monthly:
            ref_month = month if month is not None else now.month
            ref_year = year
            start, end = period_range(ref_year, ref_month)
        else:
            start, end = period_range(year, None)

        spent = transaction_repo.total_by_type_and_category(
            session, TransactionType.expense, budget.category_id, start, end
        )
        remaining = budget.amount - spent
        percentage = float(spent / budget.amount * 100) if budget.amount > 0 else 0.0
        cat = categories.get(budget.category_id)

        result.append(
            BudgetProgress(
                id=budget.id,
                category_id=budget.category_id,
                category_name=cat.name if cat else "—",
                category_color=cat.color if cat else None,
                amount=budget.amount,
                period=budget.period,
                spent=spent,
                remaining=remaining,
                percentage=round(percentage, 1),
                exceeded=spent > budget.amount,
            )
        )

    result.sort(key=lambda b: b.percentage, reverse=True)
    return result
