"""Tests for the recurring-transactions service (generation + CRUD)."""

import datetime as dt
from decimal import Decimal

import pytest
from sqlmodel import Session, select

from app.models import Account, AccountType, Category, CategoryType, Transaction
from app.models.enums import RecurrenceFrequency
from app.schemas.recurring import RecurringCreate, RecurringUpdate
from app.services import recurring as service
from app.services.exceptions import NotFoundError


def _setup(session: Session) -> tuple[Account, Category]:
    account = Account(name="Banco", type=AccountType.bank)
    rent = Category(name="Vivienda", type=CategoryType.expense)
    session.add_all([account, rent])
    session.commit()
    session.refresh(account)
    session.refresh(rent)
    return account, rent


def _txs(session: Session) -> list[Transaction]:
    return list(session.exec(select(Transaction)).all())


def test_create_generates_due_occurrences(session: Session) -> None:
    account, rent = _setup(session)
    created = service.create_recurring(
        session,
        RecurringCreate(
            type="expense",
            concept="Alquiler",
            amount=Decimal("800.00"),
            account_id=account.id,
            category_id=rent.id,
            frequency=RecurrenceFrequency.monthly,
            start_date=dt.date.today() - dt.timedelta(days=1),
        ),
    )
    # The single past occurrence (yesterday) is materialised on creation.
    txs = _txs(session)
    assert len(txs) == 1
    assert txs[0].recurring_id == created.id
    assert txs[0].amount == Decimal("800.00")
    # next_run_date advanced one month ahead.
    assert created.next_run_date > dt.date.today()


def test_run_due_is_idempotent(session: Session) -> None:
    account, rent = _setup(session)
    service.create_recurring(
        session,
        RecurringCreate(
            type="expense",
            concept="Alquiler",
            amount=Decimal("800.00"),
            account_id=account.id,
            category_id=rent.id,
            frequency=RecurrenceFrequency.monthly,
            start_date=dt.date.today(),
        ),
    )
    assert len(_txs(session)) == 1
    # Running again should not duplicate (next_run_date is in the future).
    generated = service.run_due(session)
    assert generated == 0
    assert len(_txs(session)) == 1


def test_weekly_backfill_counts_correctly(session: Session) -> None:
    account, rent = _setup(session)
    start = dt.date.today() - dt.timedelta(weeks=3)
    service.create_recurring(
        session,
        RecurringCreate(
            type="expense",
            concept="Compra semanal",
            amount=Decimal("50.00"),
            account_id=account.id,
            category_id=rent.id,
            frequency=RecurrenceFrequency.weekly,
            start_date=start,
        ),
    )
    # weeks 0,1,2,3 are all due (today is exactly 3 weeks after start).
    assert len(_txs(session)) == 4


def test_end_date_stops_generation_and_deactivates(session: Session) -> None:
    account, rent = _setup(session)
    start = dt.date.today() - dt.timedelta(days=10)
    end = dt.date.today() - dt.timedelta(days=5)
    created = service.create_recurring(
        session,
        RecurringCreate(
            type="expense",
            concept="Limitado",
            amount=Decimal("5.00"),
            account_id=account.id,
            category_id=rent.id,
            frequency=RecurrenceFrequency.daily,
            start_date=start,
            end_date=end,
        ),
    )
    # 6 daily occurrences from start..end inclusive.
    assert len(_txs(session)) == 6
    assert created.active is False


def test_monthly_anchor_handles_month_end() -> None:
    # 31 Jan with a monthly rule -> 28/29 Feb, 31 Mar, 30 Apr… (no drift):
    # the day is always re-derived from the anchor (31), not from the previous date.
    anchor = 31
    jan = dt.date(2024, 1, 31)
    feb = service._advance(jan, RecurrenceFrequency.monthly, 1, anchor)
    mar = service._advance(feb, RecurrenceFrequency.monthly, 1, anchor)
    apr = service._advance(mar, RecurrenceFrequency.monthly, 1, anchor)
    assert feb == dt.date(2024, 2, 29)  # 2024 is a leap year
    assert mar == dt.date(2024, 3, 31)  # back to 31, no drift
    assert apr == dt.date(2024, 4, 30)


def test_yearly_anchor_handles_leap_day() -> None:
    # 29 Feb yearly -> 28 Feb on non-leap years.
    leap = dt.date(2024, 2, 29)
    nxt = service._advance(leap, RecurrenceFrequency.yearly, 1, 29)
    assert nxt == dt.date(2025, 2, 28)


def test_get_unknown_raises(session: Session) -> None:
    with pytest.raises(NotFoundError):
        service.get_recurring(session, 999)


def test_update_pause_stops_generation(session: Session) -> None:
    account, rent = _setup(session)
    created = service.create_recurring(
        session,
        RecurringCreate(
            type="expense",
            concept="Pausable",
            amount=Decimal("10.00"),
            account_id=account.id,
            category_id=rent.id,
            frequency=RecurrenceFrequency.daily,
            start_date=dt.date.today(),
        ),
    )
    assert created.id is not None
    service.update_recurring(session, created.id, RecurringUpdate(active=False))
    count_before = len(_txs(session))
    service.run_due(session, today=dt.date.today() + dt.timedelta(days=5))
    assert len(_txs(session)) == count_before
