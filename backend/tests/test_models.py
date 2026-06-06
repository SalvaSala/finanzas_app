"""Schema-level tests for the SQLModel models using an in-memory database."""

from collections.abc import Generator
from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, SQLModel, create_engine, select

from app.models import (
    Account,
    AccountType,
    Category,
    CategoryType,
    Transaction,
    TransactionType,
)


@pytest.fixture(name="session")
def session_fixture() -> Generator[Session, None, None]:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


def test_create_account_category_and_transaction(session: Session) -> None:
    account = Account(name="Banco principal", type=AccountType.bank)
    category = Category(name="Alimentación", type=CategoryType.expense)
    session.add(account)
    session.add(category)
    session.commit()
    session.refresh(account)
    session.refresh(category)

    tx = Transaction(
        date=date(2026, 6, 6),
        type=TransactionType.expense,
        concept="Compra semanal",
        amount=Decimal("42.50"),
        account_id=account.id,
        category_id=category.id,
    )
    session.add(tx)
    session.commit()
    session.refresh(tx)

    stored = session.exec(select(Transaction)).one()
    assert stored.amount == Decimal("42.50")
    assert stored.account is not None and stored.account.name == "Banco principal"
    assert account.transactions[0].id == tx.id


def test_subcategory_parent_relationship(session: Session) -> None:
    parent = Category(name="Hogar", type=CategoryType.expense)
    session.add(parent)
    session.commit()
    session.refresh(parent)

    child = Category(name="Luz", type=CategoryType.expense, parent_id=parent.id)
    session.add(child)
    session.commit()
    session.refresh(child)

    assert child.parent is not None and child.parent.name == "Hogar"
    assert parent.children[0].name == "Luz"


def test_amount_must_be_positive(session: Session) -> None:
    account = Account(name="Efectivo", type=AccountType.cash)
    session.add(account)
    session.commit()
    session.refresh(account)

    bad = Transaction(
        date=date(2026, 6, 6),
        type=TransactionType.expense,
        concept="Importe inválido",
        amount=Decimal("0"),
        account_id=account.id,
    )
    session.add(bad)
    with pytest.raises(IntegrityError):
        session.commit()
