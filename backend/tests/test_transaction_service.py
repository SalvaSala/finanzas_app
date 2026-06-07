"""Tests for the transaction service (validation + CRUD)."""

import datetime as dt
from decimal import Decimal

import pytest
from sqlmodel import Session

from app.models import Account, AccountType, Category, CategoryType
from app.schemas.transaction import TransactionCreate, TransactionUpdate
from app.services import transaction as service
from app.services.exceptions import NotFoundError, ValidationError


def _setup(session: Session) -> tuple[Account, Category, Category, Category]:
    account = Account(name="Banco", type=AccountType.bank)
    food = Category(name="Alimentación", type=CategoryType.expense)
    salary = Category(name="Nómina", type=CategoryType.income)
    session.add_all([account, food, salary])
    session.commit()
    for entity in (account, food, salary):
        session.refresh(entity)

    market = Category(name="Supermercado", type=CategoryType.expense, parent_id=food.id)
    session.add(market)
    session.commit()
    session.refresh(market)
    return account, food, salary, market


def test_create_valid_transaction(session: Session) -> None:
    account, food, _, market = _setup(session)
    created = service.create_transaction(
        session,
        TransactionCreate(
            date=dt.date(2026, 6, 1),
            type=CategoryType.expense.value,
            concept="Compra",
            amount=Decimal("20.00"),
            account_id=account.id,
            category_id=food.id,
            subcategory_id=market.id,
        ),
    )
    assert created.id is not None
    assert created.amount == Decimal("20.00")


def test_create_with_unknown_account_raises(session: Session) -> None:
    _setup(session)
    with pytest.raises(NotFoundError):
        service.create_transaction(
            session,
            TransactionCreate(
                date=dt.date(2026, 6, 1),
                type="expense",
                concept="X",
                amount=Decimal("1.00"),
                account_id=999,
            ),
        )


def test_category_type_mismatch_raises(session: Session) -> None:
    account, food, _, _ = _setup(session)
    with pytest.raises(ValidationError):
        service.create_transaction(
            session,
            TransactionCreate(
                date=dt.date(2026, 6, 1),
                type="income",  # income transaction with an expense category
                concept="X",
                amount=Decimal("1.00"),
                account_id=account.id,
                category_id=food.id,
            ),
        )


def test_subcategory_must_belong_to_category(session: Session) -> None:
    account, _, _, market = _setup(session)
    other = Category(name="Transporte", type=CategoryType.expense)
    session.add(other)
    session.commit()
    session.refresh(other)

    with pytest.raises(ValidationError):
        service.create_transaction(
            session,
            TransactionCreate(
                date=dt.date(2026, 6, 1),
                type="expense",
                concept="X",
                amount=Decimal("1.00"),
                account_id=account.id,
                category_id=other.id,
                subcategory_id=market.id,  # belongs to "Alimentación", not "Transporte"
            ),
        )


def test_update_and_delete(session: Session) -> None:
    account, food, _, _ = _setup(session)
    created = service.create_transaction(
        session,
        TransactionCreate(
            date=dt.date(2026, 6, 1),
            type="expense",
            concept="Compra",
            amount=Decimal("20.00"),
            account_id=account.id,
            category_id=food.id,
        ),
    )
    assert created.id is not None

    updated = service.update_transaction(
        session,
        created.id,
        TransactionUpdate(amount=Decimal("25.00"), concept="Compra grande"),
    )
    assert updated.amount == Decimal("25.00")
    assert updated.concept == "Compra grande"

    service.delete_transaction(session, created.id)
    with pytest.raises(NotFoundError):
        service.get_transaction(session, created.id)
