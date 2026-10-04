"""Data access for manual balance adjustments."""

from decimal import Decimal

from sqlalchemy import func
from sqlmodel import Session, col, select

from app.models.balance_adjustment import BalanceAdjustment


def create(session: Session, adjustment: BalanceAdjustment) -> BalanceAdjustment:
    session.add(adjustment)
    session.commit()
    session.refresh(adjustment)
    return adjustment


def get(session: Session, adjustment_id: int) -> BalanceAdjustment | None:
    return session.get(BalanceAdjustment, adjustment_id)


def list_all(session: Session) -> list[BalanceAdjustment]:
    """Every adjustment, newest first."""
    statement = select(BalanceAdjustment).order_by(
        col(BalanceAdjustment.date).desc(), col(BalanceAdjustment.id).desc()
    )
    return list(session.exec(statement).all())


def delete(session: Session, adjustment: BalanceAdjustment) -> None:
    session.delete(adjustment)
    session.commit()


def total(session: Session) -> Decimal:
    """Signed sum of every adjustment (0 when there are none).

    Unbounded by date on purpose: an adjustment states what the balance really
    is, so it counts from the moment it is recorded; ``date`` is history, not a
    condition.
    """
    result = session.exec(select(func.coalesce(func.sum(BalanceAdjustment.amount), 0))).one()
    return Decimal(str(result))
