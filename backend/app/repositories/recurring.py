"""Data access for recurring transactions."""

import datetime as dt

from sqlmodel import Session, col, select

from app.models.recurring import RecurringTransaction


def create(session: Session, recurring: RecurringTransaction) -> RecurringTransaction:
    session.add(recurring)
    session.commit()
    session.refresh(recurring)
    return recurring


def get(session: Session, recurring_id: int) -> RecurringTransaction | None:
    return session.get(RecurringTransaction, recurring_id)


def list_all(session: Session) -> list[RecurringTransaction]:
    statement = select(RecurringTransaction).order_by(
        col(RecurringTransaction.next_run_date), col(RecurringTransaction.id)
    )
    return list(session.exec(statement).all())


def list_due(session: Session, today: dt.date) -> list[RecurringTransaction]:
    """Active recurrences whose next run date has arrived (oldest first)."""
    statement = (
        select(RecurringTransaction)
        .where(
            col(RecurringTransaction.active).is_(True),
            col(RecurringTransaction.next_run_date) <= today,
        )
        .order_by(col(RecurringTransaction.next_run_date), col(RecurringTransaction.id))
    )
    return list(session.exec(statement).all())


def update(session: Session, recurring: RecurringTransaction) -> RecurringTransaction:
    session.add(recurring)
    session.commit()
    session.refresh(recurring)
    return recurring


def delete(session: Session, recurring: RecurringTransaction) -> None:
    session.delete(recurring)
    session.commit()
