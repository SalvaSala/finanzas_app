"""Tests for the available-balance service.

The balance is "what can I still spend today", so every test pins ``today``
explicitly instead of relying on the real clock.
"""

import datetime as dt
from decimal import Decimal

from sqlmodel import Session

from app.models import Account, AccountType, Category, CategoryType
from app.schemas.balance import BalanceAdjustmentCreate, BalanceSet
from app.schemas.transaction import TransactionCreate
from app.services import balance as balance_service
from app.services import transaction as tx_service

TODAY = dt.date(2026, 6, 15)


def _seed(session: Session) -> tuple[Account, Category, Category]:
    account = Account(name="Banco", type=AccountType.bank, initial_balance=Decimal("1000.00"))
    food = Category(name="Alimentación", type=CategoryType.expense)
    salary = Category(name="Nómina", type=CategoryType.income)
    session.add_all([account, food, salary])
    session.commit()
    for entity in (account, food, salary):
        session.refresh(entity)
    return account, food, salary


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


def test_empty_balance_is_zero(session: Session) -> None:
    status = balance_service.get_status(session, TODAY)
    assert status.available == Decimal("0")
    assert status.settled == Decimal("0")
    assert status.committed_expense == Decimal("0")
    assert status.as_of == TODAY


def test_initial_balance_of_active_accounts_counts(session: Session) -> None:
    session.add(Account(name="Efectivo", type=AccountType.cash, initial_balance=Decimal("50.00")))
    session.add(
        Account(
            name="Vieja",
            type=AccountType.bank,
            initial_balance=Decimal("999.00"),
            archived=True,
        )
    )
    session.commit()

    status = balance_service.get_status(session, TODAY)
    assert status.accounts_initial == Decimal("50.00")
    assert status.available == Decimal("50.00")


def test_past_and_today_movements_affect_the_balance(session: Session) -> None:
    account, food, salary = _seed(session)
    _add(session, account, "income", "200.00", salary, dt.date(2026, 6, 1))
    _add(session, account, "expense", "80.00", food, dt.date(2026, 6, 10))
    _add(session, account, "expense", "20.00", food, TODAY)  # today still counts

    status = balance_service.get_status(session, TODAY)
    assert status.settled == Decimal("1100.00")
    assert status.committed_expense == Decimal("0")
    assert status.available == Decimal("1100.00")


def test_future_expense_is_committed_but_not_settled(session: Session) -> None:
    account, food, _ = _seed(session)
    _add(session, account, "expense", "300.00", food, dt.date(2026, 7, 1))

    status = balance_service.get_status(session, TODAY)
    assert status.settled == Decimal("1000.00")
    assert status.committed_expense == Decimal("300.00")
    assert status.available == Decimal("700.00")


def test_future_income_does_not_add_until_its_date(session: Session) -> None:
    account, _, salary = _seed(session)
    _add(session, account, "income", "2000.00", salary, dt.date(2026, 6, 30))

    status = balance_service.get_status(session, TODAY)
    assert status.available == Decimal("1000.00")

    # Once the date arrives, it counts.
    later = balance_service.get_status(session, dt.date(2026, 6, 30))
    assert later.available == Decimal("3000.00")


def test_transfers_do_not_move_the_balance(session: Session) -> None:
    account, _, _ = _seed(session)
    other = Account(name="Ahorro", type=AccountType.savings)
    session.add(other)
    session.commit()
    session.refresh(other)

    tx_service.create_transaction(
        session,
        TransactionCreate(
            date=dt.date(2026, 6, 10),
            type="transfer",
            concept="traspaso",
            amount=Decimal("500.00"),
            account_id=account.id,
            transfer_account_id=other.id,
        ),
    )

    assert balance_service.get_status(session, TODAY).available == Decimal("1000.00")


def test_adjustment_adds_to_the_balance_without_touching_movements(session: Session) -> None:
    _seed(session)
    balance_service.create_adjustment(
        session,
        BalanceAdjustmentCreate(amount=Decimal("40.00"), note="Efectivo en la cartera"),
    )

    status = balance_service.get_status(session, TODAY)
    assert status.adjustments_total == Decimal("40.00")
    assert status.available == Decimal("1040.00")


def test_negative_adjustment_subtracts(session: Session) -> None:
    _seed(session)
    balance_service.create_adjustment(session, BalanceAdjustmentCreate(amount=Decimal("-100.00")))
    assert balance_service.get_status(session, TODAY).available == Decimal("900.00")


def test_set_available_stores_the_difference(session: Session) -> None:
    account, food, _ = _seed(session)
    _add(session, account, "expense", "300.00", food, dt.date(2026, 7, 1))  # committed

    status = balance_service.set_available(
        session, BalanceSet(available=Decimal("800.00"), note="Cuadre"), TODAY
    )

    assert status.available == Decimal("800.00")
    adjustments = balance_service.list_adjustments(session)
    assert len(adjustments) == 1
    assert adjustments[0].amount == Decimal("100.00")  # 700 → 800
    assert adjustments[0].note == "Cuadre"
    assert adjustments[0].date == TODAY


def test_set_available_to_the_same_value_stores_nothing(session: Session) -> None:
    _seed(session)
    balance_service.set_available(session, BalanceSet(available=Decimal("1000.00")), TODAY)
    assert balance_service.list_adjustments(session) == []


def test_delete_adjustment_restores_the_balance(session: Session) -> None:
    _seed(session)
    created = balance_service.create_adjustment(
        session, BalanceAdjustmentCreate(amount=Decimal("40.00"))
    )
    balance_service.delete_adjustment(session, created.id)

    assert balance_service.list_adjustments(session) == []
    assert balance_service.get_status(session, TODAY).available == Decimal("1000.00")
