"""Tests for the budget service (CRUD + progress calculation)."""

import datetime as dt
from decimal import Decimal

import pytest
from sqlmodel import Session

from app.models import Account, AccountType, Category, CategoryType, Transaction
from app.models.enums import BudgetPeriod, TransactionType
from app.schemas.budget import BudgetCreate, BudgetUpdate
from app.services import budget as service
from app.services.exceptions import NotFoundError, ValidationError


def _require_id(value: int | None) -> int:
    """Narrow an optional primary key to ``int`` after commit+refresh (para mypy)."""
    assert value is not None
    return value


def _setup(session: Session) -> tuple[Account, Category, Category]:
    account = Account(name="Banco", type=AccountType.bank)
    food = Category(name="Alimentación", type=CategoryType.expense)
    transport = Category(name="Transporte", type=CategoryType.expense)
    session.add_all([account, food, transport])
    session.commit()
    for entity in (account, food, transport):
        session.refresh(entity)
    return account, food, transport


def _expense(
    session: Session,
    account: Account,
    category: Category,
    amount: str,
    date: dt.date,
) -> None:
    session.add(
        Transaction(
            date=date,
            type=TransactionType.expense,
            concept="Gasto",
            amount=Decimal(amount),
            account_id=account.id,
            category_id=category.id,
        )
    )
    session.commit()


# ── CRUD ──────────────────────────────────────────────────────────────────────


def test_create_budget(session: Session) -> None:
    _, food, _ = _setup(session)
    created = service.create_budget(
        session,
        BudgetCreate(category_id=food.id, amount=Decimal("300.00"), period=BudgetPeriod.monthly),
    )
    assert created.id is not None
    assert created.amount == Decimal("300.00")


def test_create_budget_unknown_category(session: Session) -> None:
    _setup(session)
    with pytest.raises(NotFoundError):
        service.create_budget(
            session,
            BudgetCreate(category_id=9999, amount=Decimal("50.00"), period=BudgetPeriod.monthly),
        )


def test_create_budget_rejects_duplicate_category(session: Session) -> None:
    _, food, _ = _setup(session)
    data = BudgetCreate(category_id=food.id, amount=Decimal("300.00"), period=BudgetPeriod.monthly)
    service.create_budget(session, data)
    with pytest.raises(ValidationError):
        service.create_budget(session, data)


def test_update_budget(session: Session) -> None:
    _, food, _ = _setup(session)
    created = service.create_budget(
        session,
        BudgetCreate(category_id=food.id, amount=Decimal("300.00"), period=BudgetPeriod.monthly),
    )
    updated = service.update_budget(
        session, _require_id(created.id), BudgetUpdate(amount=Decimal("450.00"))
    )
    assert updated.amount == Decimal("450.00")
    # Los campos no enviados se conservan.
    assert updated.period == BudgetPeriod.monthly


def test_delete_budget(session: Session) -> None:
    _, food, _ = _setup(session)
    created = service.create_budget(
        session,
        BudgetCreate(category_id=food.id, amount=Decimal("300.00"), period=BudgetPeriod.monthly),
    )
    service.delete_budget(session, _require_id(created.id))
    assert service.list_budgets(session) == []
    with pytest.raises(NotFoundError):
        service.get_budget(session, _require_id(created.id))


# ── Progreso ──────────────────────────────────────────────────────────────────


def test_progress_monthly_only_counts_that_month(session: Session) -> None:
    account, food, _ = _setup(session)
    service.create_budget(
        session,
        BudgetCreate(category_id=food.id, amount=Decimal("200.00"), period=BudgetPeriod.monthly),
    )
    _expense(session, account, food, "50.00", dt.date(2026, 6, 10))
    _expense(session, account, food, "30.00", dt.date(2026, 6, 20))
    _expense(session, account, food, "999.00", dt.date(2026, 7, 1))  # otro mes

    (progress,) = service.get_progress(session, 2026, 6)
    assert progress.spent == Decimal("80.00")
    assert progress.remaining == Decimal("120.00")
    assert progress.percentage == 40.0
    assert progress.exceeded is False
    assert progress.category_name == "Alimentación"


def test_progress_yearly_covers_whole_year(session: Session) -> None:
    account, food, _ = _setup(session)
    service.create_budget(
        session,
        BudgetCreate(category_id=food.id, amount=Decimal("1000.00"), period=BudgetPeriod.yearly),
    )
    _expense(session, account, food, "100.00", dt.date(2026, 1, 15))
    _expense(session, account, food, "150.00", dt.date(2026, 11, 5))
    _expense(session, account, food, "999.00", dt.date(2025, 6, 1))  # otro año

    (progress,) = service.get_progress(session, 2026, 6)
    assert progress.spent == Decimal("250.00")


def test_progress_flags_exceeded(session: Session) -> None:
    account, food, _ = _setup(session)
    service.create_budget(
        session,
        BudgetCreate(category_id=food.id, amount=Decimal("100.00"), period=BudgetPeriod.monthly),
    )
    _expense(session, account, food, "130.00", dt.date(2026, 6, 10))

    (progress,) = service.get_progress(session, 2026, 6)
    assert progress.exceeded is True
    assert progress.remaining == Decimal("-30.00")
    assert progress.percentage == 130.0


def test_progress_without_spending(session: Session) -> None:
    _, food, _ = _setup(session)
    service.create_budget(
        session,
        BudgetCreate(category_id=food.id, amount=Decimal("200.00"), period=BudgetPeriod.monthly),
    )
    (progress,) = service.get_progress(session, 2026, 6)
    assert progress.spent == Decimal("0")
    assert progress.percentage == 0.0
    assert progress.exceeded is False


def test_progress_sorted_by_percentage_desc(session: Session) -> None:
    account, food, transport = _setup(session)
    service.create_budget(
        session,
        BudgetCreate(category_id=food.id, amount=Decimal("100.00"), period=BudgetPeriod.monthly),
    )
    service.create_budget(
        session,
        BudgetCreate(
            category_id=transport.id, amount=Decimal("100.00"), period=BudgetPeriod.monthly
        ),
    )
    _expense(session, account, food, "10.00", dt.date(2026, 6, 10))
    _expense(session, account, transport, "90.00", dt.date(2026, 6, 10))

    progress = service.get_progress(session, 2026, 6)
    assert [p.category_name for p in progress] == ["Transporte", "Alimentación"]
