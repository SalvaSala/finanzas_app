"""API DTOs for the dashboard / KPIs."""

from decimal import Decimal

from pydantic import BaseModel


class CategoryAmount(BaseModel):
    """Total amount aggregated for a single category in a period."""

    category_id: int | None
    name: str
    color: str | None
    icon: str | None
    total: Decimal


class DashboardSummary(BaseModel):
    """KPIs and per-category breakdowns for a given period."""

    year: int
    month: int | None
    income: Decimal
    expense: Decimal
    balance: Decimal
    income_change: float | None = None  # % vs prior period (None when no prior data)
    expense_change: float | None = None
    balance_change: float | None = None
    expense_by_category: list[CategoryAmount]
    income_by_category: list[CategoryAmount]


class MonthlyStats(BaseModel):
    """Income, expense and cumulative balance for a single month."""

    month: int
    income: Decimal
    expense: Decimal
    balance: Decimal
    cumulative_balance: Decimal


# ── Advanced charts ───────────────────────────────────────────────────────────


class TreemapLeaf(BaseModel):
    """Leaf node (subcategory or category without subcategories) for the treemap."""

    id: str
    name: str
    value: float


class TreemapBranch(BaseModel):
    """Branch node (category) for the treemap; may contain leaf children."""

    id: str
    name: str
    color: str | None = None
    children: list[TreemapLeaf] = []
    value: float | None = None


class TreemapData(BaseModel):
    """Root node for the expense treemap."""

    id: str
    name: str
    children: list[TreemapBranch]


class DayAmount(BaseModel):
    """Daily expense total for the calendar heatmap."""

    day: str  # ISO date "YYYY-MM-DD"
    value: float


class SankeyNode(BaseModel):
    """Node in the Sankey diagram."""

    id: str
    label: str


class SankeyLink(BaseModel):
    """Directed link between two Sankey nodes."""

    source: str
    target: str
    value: float


class SankeyData(BaseModel):
    """Full Sankey diagram: nodes + links."""

    nodes: list[SankeyNode]
    links: list[SankeyLink]


class BalancePoint(BaseModel):
    """Single point in the balance history chart."""

    date: str  # "YYYY-MM-DD"
    balance: float


class CategoryAvgRow(BaseModel):
    """Monthly average vs current period for a category or subcategory."""

    category_id: int
    name: str
    color: str | None
    icon: str | None
    avg_monthly: float  # average monthly amount for the year up to selected month
    current_amount: float  # amount in the selected period
    change_pct: float | None  # (current - avg) / avg * 100; None when avg is 0
