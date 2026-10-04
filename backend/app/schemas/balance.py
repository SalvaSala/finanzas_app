"""API DTOs for the available balance and its manual adjustments."""

import datetime as dt
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class BalanceAdjustmentCreate(BaseModel):
    """A signed correction to the balance: positive adds, negative subtracts."""

    amount: Decimal = Field(max_digits=14, decimal_places=2)
    note: str | None = Field(default=None, max_length=200)
    date: dt.date | None = None  # defaults to today


class BalanceAdjustmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    date: dt.date
    amount: Decimal
    note: str | None
    created_at: dt.datetime


class BalanceSet(BaseModel):
    """Target available balance; the service stores the difference as an adjustment."""

    available: Decimal = Field(max_digits=14, decimal_places=2)
    note: str | None = Field(default=None, max_length=200)


class BalanceStatus(BaseModel):
    """The available balance right now, with the parts it is built from."""

    as_of: dt.date
    available: Decimal  # settled − committed_expense: what can still be spent
    settled: Decimal  # accounts + movements already due + adjustments
    committed_expense: Decimal  # expenses dated in the future (positive amount)
    accounts_initial: Decimal
    adjustments_total: Decimal
