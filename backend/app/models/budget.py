"""Budget model: spending limit per category for a period."""

from decimal import Decimal
from typing import TYPE_CHECKING, Optional

from sqlmodel import Field, Relationship, SQLModel

from app.models.enums import BudgetPeriod

if TYPE_CHECKING:
    from app.models.category import Category


class Budget(SQLModel, table=True):
    __tablename__ = "budgets"

    id: int | None = Field(default=None, primary_key=True)
    category_id: int = Field(foreign_key="categories.id", index=True)
    amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    period: BudgetPeriod

    category: Optional["Category"] = Relationship()
