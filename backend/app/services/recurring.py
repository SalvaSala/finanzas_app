"""Business logic for recurring transactions.

A recurrence is a transaction template plus a rule (frequency + interval +
start/end). :func:`run_due` materialises every occurrence whose date has arrived,
creating a real :class:`Transaction` stamped with ``recurring_id`` and advancing
the recurrence's ``next_run_date``. It is idempotent: running it twice does not
duplicate movements, because ``next_run_date`` only moves forward.
"""

import calendar
import datetime as dt

from sqlmodel import Session

from app.models import Transaction
from app.models.enums import RecurrenceFrequency
from app.models.recurring import RecurringTransaction
from app.repositories import recurring as recurring_repo
from app.schemas.recurring import RecurringCreate, RecurringUpdate
from app.services.exceptions import NotFoundError
from app.services.transaction import _validate_refs


def _add_months(base: dt.date, months: int, anchor_day: int) -> dt.date:
    """Add ``months`` to ``base`` keeping the original day-of-month when possible.

    Anchoring on ``anchor_day`` (the recurrence start day) avoids drift: a
    monthly rule starting on the 31st yields 31, 28/29, 31… instead of creeping
    backwards each month.
    """
    total = base.month - 1 + months
    year = base.year + total // 12
    month = total % 12 + 1
    last_day = calendar.monthrange(year, month)[1]
    return dt.date(year, month, min(anchor_day, last_day))


def _advance(
    current: dt.date, frequency: RecurrenceFrequency, interval: int, anchor_day: int
) -> dt.date:
    if frequency == RecurrenceFrequency.daily:
        return current + dt.timedelta(days=interval)
    if frequency == RecurrenceFrequency.weekly:
        return current + dt.timedelta(weeks=interval)
    if frequency == RecurrenceFrequency.monthly:
        return _add_months(current, interval, anchor_day)
    return _add_months(current, 12 * interval, anchor_day)


def _generate_one(session: Session, recurring: RecurringTransaction, today: dt.date) -> int:
    """Create the transactions due for a single recurrence up to ``today``."""
    generated = 0
    anchor_day = recurring.start_date.day
    while (
        recurring.active
        and recurring.next_run_date <= today
        and (recurring.end_date is None or recurring.next_run_date <= recurring.end_date)
    ):
        session.add(
            Transaction(
                date=recurring.next_run_date,
                type=recurring.type,
                concept=recurring.concept,
                description=recurring.description,
                amount=recurring.amount,
                category_id=recurring.category_id,
                subcategory_id=recurring.subcategory_id,
                account_id=recurring.account_id,
                transfer_account_id=recurring.transfer_account_id,
                recurring_id=recurring.id,
            )
        )
        generated += 1
        recurring.next_run_date = _advance(
            recurring.next_run_date, recurring.frequency, recurring.interval, anchor_day
        )

    if recurring.end_date is not None and recurring.next_run_date > recurring.end_date:
        recurring.active = False
    session.add(recurring)
    return generated


def run_due(session: Session, today: dt.date | None = None) -> int:
    """Generate all pending transactions for every active recurrence."""
    today = today or dt.date.today()
    total = 0
    for recurring in recurring_repo.list_due(session, today):
        total += _generate_one(session, recurring, today)
    session.commit()
    return total


def create_recurring(session: Session, data: RecurringCreate) -> RecurringTransaction:
    _validate_refs(
        session,
        transaction_type=data.type,
        account_id=data.account_id,
        transfer_account_id=data.transfer_account_id,
        category_id=data.category_id,
        subcategory_id=data.subcategory_id,
    )
    recurring = RecurringTransaction(**data.model_dump(), next_run_date=data.start_date)
    recurring = recurring_repo.create(session, recurring)

    # Materialise occurrences already due (start_date in the past or today).
    today = dt.date.today()
    if recurring.active and recurring.next_run_date <= today:
        _generate_one(session, recurring, today)
        session.commit()
        session.refresh(recurring)
    return recurring


def get_recurring(session: Session, recurring_id: int) -> RecurringTransaction:
    recurring = recurring_repo.get(session, recurring_id)
    if recurring is None:
        raise NotFoundError("La recurrencia indicada no existe.")
    return recurring


def list_recurring(session: Session) -> list[RecurringTransaction]:
    return recurring_repo.list_all(session)


def update_recurring(
    session: Session, recurring_id: int, data: RecurringUpdate
) -> RecurringTransaction:
    recurring = get_recurring(session, recurring_id)
    changes = data.model_dump(exclude_unset=True)

    _validate_refs(
        session,
        transaction_type=recurring.type,
        account_id=changes.get("account_id", recurring.account_id),
        transfer_account_id=changes.get("transfer_account_id", recurring.transfer_account_id),
        category_id=changes.get("category_id", recurring.category_id),
        subcategory_id=changes.get("subcategory_id", recurring.subcategory_id),
    )

    for field, value in changes.items():
        setattr(recurring, field, value)

    # If the start date was pushed forward, move the next run forward too
    # (never backwards, to avoid regenerating already-created movements).
    if "start_date" in changes and recurring.next_run_date < recurring.start_date:
        recurring.next_run_date = recurring.start_date

    return recurring_repo.update(session, recurring)


def delete_recurring(session: Session, recurring_id: int) -> None:
    recurring = get_recurring(session, recurring_id)
    recurring_repo.delete(session, recurring)
