"""BalanceAdjustment model: manual corrections to the available balance.

The available balance is derived from accounts and transactions, but real life
leaks: cash found in a pocket, an account opened with the wrong initial amount,
a rounding drift. An adjustment records that difference without pretending to be
a movement, so it never shows up in the income/expense KPIs or the per-category
charts.

``amount`` is **signed**: positive adds to the balance, negative subtracts.
Never use float for money.
"""

import datetime as dt
from decimal import Decimal

from sqlmodel import Field, SQLModel


class BalanceAdjustment(SQLModel, table=True):
    __tablename__ = "balance_adjustments"

    id: int | None = Field(default=None, primary_key=True)
    date: dt.date = Field(index=True)
    amount: Decimal = Field(max_digits=14, decimal_places=2)
    note: str | None = Field(default=None)
    created_at: dt.datetime = Field(default_factory=lambda: dt.datetime.now(dt.UTC))
