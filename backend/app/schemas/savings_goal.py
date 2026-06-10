"""API DTOs for savings goals."""

import datetime as dt
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class SavingsGoalCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    target_amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    current_amount: Decimal = Field(default=Decimal("0"), ge=0, max_digits=14, decimal_places=2)
    deadline: dt.date | None = None
    color: str | None = None


class SavingsGoalUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    target_amount: Decimal | None = Field(default=None, gt=0, max_digits=14, decimal_places=2)
    current_amount: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=2)
    deadline: dt.date | None = None
    color: str | None = None


class SavingsGoalContribute(BaseModel):
    amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)


class SavingsGoalRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    target_amount: Decimal
    current_amount: Decimal
    deadline: dt.date | None
    color: str | None
    created_at: dt.datetime
    progress_pct: float
    is_completed: bool
    days_remaining: int | None
