"""SavingsGoal model: tracks progress towards a monetary target."""

import datetime as dt
from decimal import Decimal

from sqlmodel import Field, SQLModel


class SavingsGoal(SQLModel, table=True):
    __tablename__ = "savings_goals"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    target_amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    current_amount: Decimal = Field(default=Decimal("0"), ge=0, max_digits=14, decimal_places=2)
    deadline: dt.date | None = Field(default=None)
    color: str | None = Field(default=None)
    created_at: dt.datetime = Field(default_factory=lambda: dt.datetime.now(dt.UTC))
