"""Tests for the dashboard service (KPIs and per-category breakdown)."""

import datetime as dt
from decimal import Decimal

from sqlmodel import Session

from app.models import Account, AccountType, Category, CategoryType
from app.schemas.transaction import TransactionCreate
from app.services import transaction as tx_service
from app.services.dashboard import get_summary


def _seed(session: Session) -> tuple[Account, Category, Category, Category]:
    account = Account(name="Banco", type=AccountType.bank)
    food = Category(name="Alimentación", type=CategoryType.expense)
    home = Category(name="Vivienda", type=CategoryType.expense)
    salary = Category(name="Nómina", type=CategoryType.income)
    session.add_all([account, food, home, salary])
    session.commit()
    for entity in (account, food, home, salary):
        session.refresh(entity)
    return account, food, home, salary


def _add(
    session: Session,
    account: Account,
    type_: str,
    amount: str,
    category: Category,
    date: dt.date,
) -> None:
    tx_service.create_transaction(
        session,
        TransactionCreate(
            date=date,
            type=type_,
            concept="x",
            amount=Decimal(amount),
            account_id=account.id,
            category_id=category.id,
        ),
    )


def test_summary_totals_and_breakdown(session: Session) -> None:
    account, food, home, salary = _seed(session)
    _add(session, account, "income", "1000.00", salary, dt.date(2026, 6, 5))
    _add(session, account, "expense", "200.00", food, dt.date(2026, 6, 10))
    _add(session, account, "expense", "300.00", home, dt.date(2026, 6, 15))
    _add(session, account, "expense", "999.00", food, dt.date(2026, 7, 1))  # out of June

    summary = get_summary(session, 2026, 6)
    assert summary.income == Decimal("1000.00")
    assert summary.expense == Decimal("500.00")
    assert summary.balance == Decimal("500.00")

    # Breakdown is sorted by total descending.
    assert [(item.name, item.total) for item in summary.expense_by_category] == [
        ("Vivienda", Decimal("300.00")),
        ("Alimentación", Decimal("200.00")),
    ]


def test_summary_year_includes_all_months(session: Session) -> None:
    account, food, _, _ = _seed(session)
    _add(session, account, "expense", "200.00", food, dt.date(2026, 6, 10))
    _add(session, account, "expense", "999.00", food, dt.date(2026, 7, 1))

    summary = get_summary(session, 2026, None)
    assert summary.expense == Decimal("1199.00")
