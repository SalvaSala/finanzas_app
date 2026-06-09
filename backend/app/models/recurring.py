"""RecurringTransaction model: a template + frequency that generates transactions.

It stores the same editable fields as a :class:`Transaction` (concept, amount,
account, category…) plus a recurrence rule (frequency + interval + start/end).
A background pass (see ``services/recurring.py``) materialises the due movements
and stamps each generated transaction with ``recurring_id``.
"""

import datetime as dt
from decimal import Decimal

from sqlalchemy import CheckConstraint
from sqlmodel import Field, SQLModel

from app.models.enums import RecurrenceFrequency, TransactionType


class RecurringTransaction(SQLModel, table=True):
    __tablename__ = "recurring_transactions"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_recurring_amount_positive"),
        CheckConstraint("interval > 0", name="ck_recurring_interval_positive"),
    )

    id: int | None = Field(default=None, primary_key=True)

    # Transaction template (mirrors the editable fields of Transaction).
    type: TransactionType = Field(index=True)
    concept: str
    description: str | None = Field(default=None)
    amount: Decimal = Field(max_digits=14, decimal_places=2)
    category_id: int | None = Field(default=None, foreign_key="categories.id", index=True)
    subcategory_id: int | None = Field(default=None, foreign_key="categories.id", index=True)
    account_id: int = Field(foreign_key="accounts.id", index=True)
    transfer_account_id: int | None = Field(default=None, foreign_key="accounts.id", index=True)

    # Recurrence rule.
    frequency: RecurrenceFrequency
    interval: int = Field(default=1)
    start_date: dt.date
    end_date: dt.date | None = Field(default=None)
    next_run_date: dt.date = Field(index=True)
    active: bool = Field(default=True)

    created_at: dt.datetime = Field(default_factory=lambda: dt.datetime.now(dt.UTC))
