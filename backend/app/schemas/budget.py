"""API DTOs for budgets."""

from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import BudgetPeriod


class BudgetCreate(BaseModel):
    category_id: int
    amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    period: BudgetPeriod


class BudgetUpdate(BaseModel):
    amount: Decimal | None = Field(default=None, gt=0, max_digits=14, decimal_places=2)
    period: BudgetPeriod | None = None


class BudgetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    category_id: int
    amount: Decimal
    period: BudgetPeriod


class BudgetProgress(BaseModel):
    id: int
    category_id: int
    category_name: str
    category_color: str | None
    amount: Decimal
    period: BudgetPeriod
    spent: Decimal
    remaining: Decimal
    percentage: float
    exceeded: bool
