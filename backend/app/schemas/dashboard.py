"""API DTOs for the dashboard / KPIs."""

from decimal import Decimal

from pydantic import BaseModel


class CategoryAmount(BaseModel):
    """Total amount aggregated for a single category in a period."""

    category_id: int | None
    name: str
    color: str | None
    total: Decimal


class DashboardSummary(BaseModel):
    """KPIs and per-category breakdowns for a given period."""

    year: int
    month: int | None
    income: Decimal
    expense: Decimal
    balance: Decimal
    expense_by_category: list[CategoryAmount]
    income_by_category: list[CategoryAmount]
