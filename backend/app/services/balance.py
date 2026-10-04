"""Business logic for the available balance KPI and its manual adjustments.

The available balance answers "how much can I still spend today?", so it is
deliberately independent of the dashboard's period selector:

    settled   = initial balance of active accounts
              + net of movements dated today or earlier
              + manual adjustments
    available = settled − expenses dated in the future

Future expenses are already subtracted (the money is committed), while future
income is not added until its date arrives: the balance never shows money that
has not landed yet. Transfers are ignored, since they net to zero globally.
"""

import datetime as dt
from decimal import Decimal

from sqlmodel import Session

from app.models.balance_adjustment import BalanceAdjustment
from app.repositories import account as account_repo
from app.repositories import balance_adjustment as adjustment_repo
from app.repositories import transaction as transaction_repo
from app.schemas.balance import (
    BalanceAdjustmentCreate,
    BalanceAdjustmentRead,
    BalanceSet,
    BalanceStatus,
)
from app.services.exceptions import NotFoundError


def get_status(session: Session, today: dt.date | None = None) -> BalanceStatus:
    """Compute the available balance as of ``today`` (defaults to the real date)."""
    as_of = today or dt.date.today()

    accounts_initial = account_repo.total_initial_balance(session)
    settled_net = transaction_repo.net_up_to(session, as_of)
    committed = transaction_repo.total_expense_after(session, as_of)
    adjustments = adjustment_repo.total(session)

    settled = accounts_initial + settled_net + adjustments
    return BalanceStatus(
        as_of=as_of,
        available=settled - committed,
        settled=settled,
        committed_expense=committed,
        accounts_initial=accounts_initial,
        adjustments_total=adjustments,
    )


def list_adjustments(session: Session) -> list[BalanceAdjustmentRead]:
    return [BalanceAdjustmentRead.model_validate(a) for a in adjustment_repo.list_all(session)]


def create_adjustment(session: Session, data: BalanceAdjustmentCreate) -> BalanceAdjustmentRead:
    adjustment = BalanceAdjustment(
        date=data.date or dt.date.today(),
        amount=data.amount,
        note=data.note,
    )
    return BalanceAdjustmentRead.model_validate(adjustment_repo.create(session, adjustment))


def delete_adjustment(session: Session, adjustment_id: int) -> None:
    adjustment = adjustment_repo.get(session, adjustment_id)
    if adjustment is None:
        raise NotFoundError("El ajuste de saldo indicado no existe.")
    adjustment_repo.delete(session, adjustment)


def set_available(
    session: Session, data: BalanceSet, today: dt.date | None = None
) -> BalanceStatus:
    """Make the available balance equal ``data.available`` by storing the difference.

    Nothing is written when the balance already matches, so repeatedly saving
    the same figure does not pile up zero-value adjustments.
    """
    as_of = today or dt.date.today()
    current = get_status(session, as_of)
    delta = data.available - current.available
    if delta != Decimal("0"):
        create_adjustment(
            session,
            BalanceAdjustmentCreate(amount=delta, note=data.note, date=as_of),
        )
    return get_status(session, as_of)
