"""Data access for transactions, including period aggregations done in the DB."""

import datetime as dt
from decimal import Decimal

from sqlalchemy import func
from sqlmodel import Session, col, select

from app.models import Transaction
from app.models.enums import TransactionType


def create(session: Session, transaction: Transaction) -> Transaction:
    session.add(transaction)
    session.commit()
    session.refresh(transaction)
    return transaction


def get(session: Session, transaction_id: int) -> Transaction | None:
    return session.get(Transaction, transaction_id)


def update(session: Session, transaction: Transaction) -> Transaction:
    session.add(transaction)
    session.commit()
    session.refresh(transaction)
    return transaction


def delete(session: Session, transaction: Transaction) -> None:
    session.delete(transaction)
    session.commit()


def list_(
    session: Session,
    start: dt.date | None = None,
    end: dt.date | None = None,
    limit: int | None = None,
) -> list[Transaction]:
    """List transactions (newest first), optionally filtered by date range."""
    statement = select(Transaction)
    if start is not None:
        statement = statement.where(col(Transaction.date) >= start)
    if end is not None:
        statement = statement.where(col(Transaction.date) <= end)
    statement = statement.order_by(col(Transaction.date).desc(), col(Transaction.id).desc())
    if limit is not None:
        statement = statement.limit(limit)
    return list(session.exec(statement).all())


def total_by_type(
    session: Session,
    transaction_type: TransactionType,
    start: dt.date,
    end: dt.date,
) -> Decimal:
    """Sum of amounts for a type within a date range (0 when there are none)."""
    statement = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
        col(Transaction.type) == transaction_type,
        col(Transaction.date) >= start,
        col(Transaction.date) <= end,
    )
    total = session.exec(statement).one()
    return Decimal(str(total))


def sum_by_category(
    session: Session,
    transaction_type: TransactionType,
    start: dt.date,
    end: dt.date,
) -> list[tuple[int | None, Decimal]]:
    """Total amount grouped by ``category_id`` for a type within a date range."""
    statement = (
        select(
            Transaction.category_id,
            func.coalesce(func.sum(Transaction.amount), 0),
        )
        .where(
            col(Transaction.type) == transaction_type,
            col(Transaction.date) >= start,
            col(Transaction.date) <= end,
        )
        .group_by(col(Transaction.category_id))
    )
    rows = session.exec(statement).all()
    return [(row[0], Decimal(str(row[1]))) for row in rows]
