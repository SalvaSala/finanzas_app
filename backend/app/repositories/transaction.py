"""Data access for transactions, including period aggregations done in the DB."""

import datetime as dt
from decimal import Decimal

from sqlalchemy import case, exists, func
from sqlmodel import Session, col, select

from app.models import Category, Transaction, transaction_tags_table
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
    transaction_type: TransactionType | None = None,
    category_id: int | None = None,
    subcategory_id: int | None = None,
    account_id: int | None = None,
    search: str | None = None,
    tag_id: int | None = None,
    no_category: bool = False,
    no_subcategory: bool = False,
) -> list[Transaction]:
    """List transactions (newest first) with optional filters."""
    statement = select(Transaction)
    if start is not None:
        statement = statement.where(col(Transaction.date) >= start)
    if end is not None:
        statement = statement.where(col(Transaction.date) <= end)
    if transaction_type is not None:
        statement = statement.where(col(Transaction.type) == transaction_type)
    if subcategory_id is not None:
        statement = statement.where(col(Transaction.subcategory_id) == subcategory_id)
    elif no_subcategory:
        has_subcategories = exists().where(
            col(Category.parent_id) == col(Transaction.category_id)
        )
        statement = statement.where(
            col(Transaction.category_id).is_not(None),
            col(Transaction.subcategory_id).is_(None),
            has_subcategories,
        )
    elif no_category:
        statement = statement.where(col(Transaction.category_id).is_(None))
    elif category_id is not None:
        statement = statement.where(col(Transaction.category_id) == category_id)
    if account_id is not None:
        statement = statement.where(
            (col(Transaction.account_id) == account_id)
            | (col(Transaction.transfer_account_id) == account_id)
        )
    if search is not None and search.strip():
        statement = statement.where(col(Transaction.concept).ilike(f"%{search.strip()}%"))
    if tag_id is not None:
        statement = statement.where(
            col(Transaction.id).in_(
                select(transaction_tags_table.c.transaction_id).where(
                    transaction_tags_table.c.tag_id == tag_id
                )
            )
        )
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


def total_by_type_and_category(
    session: Session,
    transaction_type: TransactionType,
    category_id: int,
    start: dt.date,
    end: dt.date,
) -> Decimal:
    """Sum of amounts for a type+category within a date range."""
    statement = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
        col(Transaction.type) == transaction_type,
        col(Transaction.category_id) == category_id,
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


def sum_by_category_subcategory(
    session: Session,
    transaction_type: TransactionType,
    start: dt.date,
    end: dt.date,
) -> list[tuple[int | None, int | None, Decimal]]:
    """Total grouped by (category_id, subcategory_id) for the treemap."""
    statement = (
        select(
            Transaction.category_id,
            Transaction.subcategory_id,
            func.coalesce(func.sum(Transaction.amount), 0),
        )
        .where(
            col(Transaction.type) == transaction_type,
            col(Transaction.date) >= start,
            col(Transaction.date) <= end,
        )
        .group_by(col(Transaction.category_id), col(Transaction.subcategory_id))
    )
    rows = session.exec(statement).all()
    return [(row[0], row[1], Decimal(str(row[2]))) for row in rows]


def sum_subcategories_for_category(
    session: Session,
    transaction_type: TransactionType,
    start: dt.date,
    end: dt.date,
    category_id: int,
) -> list[tuple[int | None, Decimal]]:
    """Total grouped by subcategory_id for a specific parent category."""
    statement = (
        select(
            Transaction.subcategory_id,
            func.coalesce(func.sum(Transaction.amount), 0),
        )
        .where(
            col(Transaction.type) == transaction_type,
            col(Transaction.category_id) == category_id,
            col(Transaction.date) >= start,
            col(Transaction.date) <= end,
        )
        .group_by(col(Transaction.subcategory_id))
    )
    rows = session.exec(statement).all()
    return [(row[0], Decimal(str(row[1]))) for row in rows]


def sum_by_day(
    session: Session,
    transaction_type: TransactionType,
    start: dt.date,
    end: dt.date,
) -> list[tuple[dt.date, Decimal]]:
    """Total amount per calendar day for a type within a date range."""
    statement = (
        select(
            col(Transaction.date),
            func.coalesce(func.sum(Transaction.amount), 0),
        )
        .where(
            col(Transaction.type) == transaction_type,
            col(Transaction.date) >= start,
            col(Transaction.date) <= end,
        )
        .group_by(col(Transaction.date))
        .order_by(col(Transaction.date))
    )
    rows = session.exec(statement).all()
    return [(row[0], Decimal(str(row[1]))) for row in rows]


def _net_expr() -> object:
    """SQLAlchemy CASE expression: +amount for income, -amount for expense."""
    return case(
        (col(Transaction.type) == TransactionType.income, col(Transaction.amount)),
        else_=col(Transaction.amount) * -1,
    )


def net_by_day(
    session: Session,
    start: dt.date,
    end: dt.date,
) -> list[tuple[dt.date, Decimal]]:
    """Net (income − expense) per calendar day within a date range."""
    statement = (
        select(col(Transaction.date), func.sum(_net_expr()))
        .where(
            col(Transaction.type).in_([TransactionType.income, TransactionType.expense]),
            col(Transaction.date) >= start,
            col(Transaction.date) <= end,
        )
        .group_by(col(Transaction.date))
        .order_by(col(Transaction.date))
    )
    rows = session.exec(statement).all()
    return [(row[0], Decimal(str(row[1]))) for row in rows]


def suggest_concepts(
    session: Session, q: str, limit: int = 8
) -> list[tuple[str, int | None, int | None]]:
    """Return up to `limit` distinct concepts matching `q`, with the category and subcategory
    from the most recent transaction that used each concept."""
    # Subquery: for each matching concept, find the most recent transaction id.
    subq = (
        select(
            Transaction.concept,
            func.max(Transaction.id).label("max_id"),
        )
        .where(col(Transaction.concept).ilike(f"%{q}%"))
        .where(col(Transaction.type) != TransactionType.transfer)
        .group_by(Transaction.concept)
        .order_by(func.max(Transaction.date).desc(), func.max(Transaction.id).desc())
        .limit(limit)
        .subquery()
    )
    stmt = select(
        Transaction.concept,
        Transaction.category_id,
        Transaction.subcategory_id,
    ).join(subq, col(Transaction.id) == subq.c.max_id)

    rows = session.exec(stmt).all()
    return [(r[0], r[1], r[2]) for r in rows]


def cumulative_net_before(session: Session, before_date: dt.date) -> Decimal:
    """Cumulative net balance (income − expense) for all transactions before a given date."""
    result = session.exec(
        select(func.coalesce(func.sum(_net_expr()), 0)).where(
            col(Transaction.type).in_([TransactionType.income, TransactionType.expense]),
            col(Transaction.date) < before_date,
        )
    ).one()
    return Decimal(str(result))
