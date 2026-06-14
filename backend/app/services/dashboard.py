"""Business logic for the dashboard: KPIs and per-category breakdowns.

All aggregations are computed in the database (see ``repositories.transaction``);
this layer only resolves category names/colors and assembles the response.
"""

import datetime as dt
from decimal import Decimal

from sqlmodel import Session

from app.models.enums import TransactionType
from app.repositories import category as category_repo
from app.repositories import transaction as transaction_repo
from app.schemas.dashboard import (
    BalancePoint,
    CategoryAmount,
    CategoryAvgRow,
    DashboardSummary,
    DayAmount,
    MonthlyStats,
    SankeyData,
    SankeyLink,
    SankeyNode,
    TreemapBranch,
    TreemapData,
    TreemapLeaf,
)
from app.services.periods import period_range

UNCATEGORIZED_LABEL = "Sin categoría"


def _pct_change(current: Decimal, previous: Decimal) -> float | None:
    if previous == 0:
        return None
    return round(float((current - previous) / abs(previous) * 100), 1)


def _prior_period(year: int, month: int | None) -> tuple[int, int | None]:
    if month is None:
        return year - 1, None
    if month == 1:
        return year - 1, 12
    return year, month - 1


def get_summary(session: Session, year: int, month: int | None) -> DashboardSummary:
    start, end = period_range(year, month)

    income = transaction_repo.total_by_type(session, TransactionType.income, start, end)
    expense = transaction_repo.total_by_type(session, TransactionType.expense, start, end)

    # Prior period for % variation
    prior_year, prior_month = _prior_period(year, month)
    prior_start, prior_end = period_range(prior_year, prior_month)
    prior_income = transaction_repo.total_by_type(
        session, TransactionType.income, prior_start, prior_end
    )
    prior_expense = transaction_repo.total_by_type(
        session, TransactionType.expense, prior_start, prior_end
    )
    balance = income - expense
    prior_balance = prior_income - prior_expense

    categories = {category.id: category for category in category_repo.list_all(session)}

    def breakdown(transaction_type: TransactionType) -> list[CategoryAmount]:
        rows = transaction_repo.sum_by_category(session, transaction_type, start, end)
        items = [
            CategoryAmount(
                category_id=category_id,
                name=(
                    categories[category_id].name
                    if category_id in categories
                    else UNCATEGORIZED_LABEL
                ),
                color=categories[category_id].color if category_id in categories else None,
                total=total,
            )
            for category_id, total in rows
        ]
        items.sort(key=lambda item: item.total, reverse=True)
        return items

    return DashboardSummary(
        year=year,
        month=month,
        income=income,
        expense=expense,
        balance=Decimal(balance),
        income_change=_pct_change(income, prior_income),
        expense_change=_pct_change(expense, prior_expense),
        balance_change=_pct_change(balance, prior_balance),
        expense_by_category=breakdown(TransactionType.expense),
        income_by_category=breakdown(TransactionType.income),
    )


def get_subcategory_breakdown(
    session: Session,
    year: int,
    month: int | None,
    category_id: int,
    transaction_type_str: str = "expense",
) -> list[CategoryAmount]:
    """Breakdown by subcategory for a given parent category and period."""
    start, end = period_range(year, month)
    categories = {c.id: c for c in category_repo.list_all(session)}
    tx_type = (
        TransactionType.income if transaction_type_str == "income" else TransactionType.expense
    )
    rows = transaction_repo.sum_subcategories_for_category(
        session, tx_type, start, end, category_id
    )
    items = [
        CategoryAmount(
            category_id=subcat_id,
            name=(
                categories[subcat_id].name
                if subcat_id is not None and subcat_id in categories
                else UNCATEGORIZED_LABEL
            ),
            color=(
                categories[subcat_id].color
                if subcat_id is not None and subcat_id in categories
                else None
            ),
            total=total,
        )
        for subcat_id, total in rows
    ]
    items.sort(key=lambda item: item.total, reverse=True)
    return items


def get_monthly_breakdown(session: Session, year: int) -> list[MonthlyStats]:
    """Monthly income/expense/balance for each of the 12 months of a year."""
    cumulative = Decimal("0")
    result = []
    for month in range(1, 13):
        start, end = period_range(year, month)
        income = transaction_repo.total_by_type(session, TransactionType.income, start, end)
        expense = transaction_repo.total_by_type(session, TransactionType.expense, start, end)
        balance = income - expense
        cumulative += balance
        result.append(
            MonthlyStats(
                month=month,
                income=income,
                expense=expense,
                balance=balance,
                cumulative_balance=cumulative,
            )
        )
    return result


# ── Advanced charts ───────────────────────────────────────────────────────────


def get_treemap(session: Session, year: int, month: int | None) -> TreemapData:
    """Expense breakdown by category → subcategory for the treemap."""
    start, end = period_range(year, month)
    categories = {c.id: c for c in category_repo.list_all(session)}

    rows = transaction_repo.sum_by_category_subcategory(
        session, TransactionType.expense, start, end
    )

    # cat_id → {"direct": Decimal, "subcats": {subcat_id: Decimal}}
    cat_data: dict[int | None, dict] = {}
    for cat_id, subcat_id, total in rows:
        if cat_id not in cat_data:
            cat_data[cat_id] = {"direct": Decimal(0), "subcats": {}}
        if subcat_id is None:
            cat_data[cat_id]["direct"] += total
        else:
            cat_data[cat_id]["subcats"][subcat_id] = total

    branches: list[TreemapBranch] = []
    for cat_id, data in cat_data.items():
        cat = categories.get(cat_id) if cat_id is not None else None
        cat_name = cat.name if cat else UNCATEGORIZED_LABEL
        cat_color = cat.color if cat else None
        direct: Decimal = data["direct"]
        subcats: dict[int, Decimal] = data["subcats"]

        if subcats:
            children: list[TreemapLeaf] = []
            for subcat_id, subcat_total in subcats.items():
                subcat = categories.get(subcat_id)
                children.append(
                    TreemapLeaf(
                        id=f"subcat-{subcat_id}",
                        name=subcat.name if subcat else "Sin subcategoría",
                        value=float(subcat_total),
                    )
                )
            if direct > 0:
                children.append(
                    TreemapLeaf(
                        id=f"cat-{cat_id}-direct",
                        name="Otros",
                        value=float(direct),
                    )
                )
            branches.append(
                TreemapBranch(
                    id=f"cat-{cat_id}",
                    name=cat_name,
                    color=cat_color,
                    children=children,
                )
            )
        else:
            branches.append(
                TreemapBranch(
                    id=f"cat-{cat_id}",
                    name=cat_name,
                    color=cat_color,
                    value=float(direct),
                )
            )

    return TreemapData(id="gastos", name="Gastos", children=branches)


def get_calendar(session: Session, year: int) -> list[DayAmount]:
    """Daily expense totals for the calendar heatmap."""
    start = dt.date(year, 1, 1)
    end = dt.date(year, 12, 31)
    rows = transaction_repo.sum_by_day(session, TransactionType.expense, start, end)
    return [DayAmount(day=str(day), value=float(total)) for day, total in rows]


def get_sankey(session: Session, year: int, month: int | None) -> SankeyData:
    """Income → expenses Sankey diagram: income categories → central pool → expense categories."""
    start, end = period_range(year, month)
    categories = {c.id: c for c in category_repo.list_all(session)}

    income_rows = transaction_repo.sum_by_category(session, TransactionType.income, start, end)
    expense_rows = transaction_repo.sum_by_category(session, TransactionType.expense, start, end)

    total_income = sum((t for _, t in income_rows), Decimal(0))
    total_expense = sum((t for _, t in expense_rows), Decimal(0))
    balance = total_income - total_expense

    nodes: list[SankeyNode] = []
    links: list[SankeyLink] = []

    pool_id = "pool__ingresos"
    nodes.append(SankeyNode(id=pool_id, label="Ingresos"))

    for cat_id, total in income_rows:
        if float(total) <= 0:
            continue
        cat = categories.get(cat_id) if cat_id is not None else None
        node_id = f"i__{cat_id}" if cat_id is not None else "i__none"
        label = cat.name if cat else UNCATEGORIZED_LABEL
        nodes.append(SankeyNode(id=node_id, label=label))
        links.append(SankeyLink(source=node_id, target=pool_id, value=float(total)))

    for cat_id, total in expense_rows:
        if float(total) <= 0:
            continue
        cat = categories.get(cat_id) if cat_id is not None else None
        node_id = f"g__{cat_id}" if cat_id is not None else "g__none"
        label = cat.name if cat else UNCATEGORIZED_LABEL
        nodes.append(SankeyNode(id=node_id, label=label))
        links.append(SankeyLink(source=pool_id, target=node_id, value=float(total)))

    if balance > 0:
        nodes.append(SankeyNode(id="pool__ahorro", label="Ahorro"))
        links.append(SankeyLink(source=pool_id, target="pool__ahorro", value=float(balance)))

    return SankeyData(nodes=nodes, links=links)


def get_category_averages(
    session: Session,
    year: int,
    month: int | None,
    transaction_type_str: str,
    parent_id: int | None = None,
) -> list[CategoryAvgRow]:
    """Monthly average vs current period amount for each category (or subcategory).

    Average = sum(Jan → selected month of ``year``) / num_months.
    For a full-year view of the current year, the window ends at the current month.
    For a past year with no month selected, the window covers all 12 months.
    """
    today = dt.date.today()
    tx_type = (
        TransactionType.income if transaction_type_str == "income" else TransactionType.expense
    )

    # Current period (the "este mes/año" column)
    current_start, current_end = period_range(year, month)

    # Average window: always starts Jan 1 of the selected year
    avg_start = dt.date(year, 1, 1)
    if month is not None:
        # Selected a specific month → average over Jan..month
        avg_end = current_end
        avg_months = month
    elif year < today.year:
        # Past year, full-year view → average over all 12 months
        avg_end = dt.date(year, 12, 31)
        avg_months = 12
    elif year == today.year:
        # Current year, full-year view → average over Jan..current month
        avg_months = today.month
        _, avg_end = period_range(year, today.month)
    else:
        # Future year: no data
        avg_months = 1
        avg_end = avg_start

    avg_divisor = Decimal(avg_months)
    categories = {c.id: c for c in category_repo.list_all(session)}

    def _build_row(cat_id: int, current: Decimal, avg_total: Decimal) -> CategoryAvgRow:
        cat = categories[cat_id]
        avg_monthly = avg_total / avg_divisor
        return CategoryAvgRow(
            category_id=cat_id,
            name=cat.name,
            color=cat.color,
            icon=cat.icon,
            avg_monthly=float(avg_monthly),
            current_amount=float(current),
            change_pct=_pct_change(current, avg_monthly),
        )

    if parent_id is None:
        current_map = dict(
            transaction_repo.sum_by_category(session, tx_type, current_start, current_end)
        )
        avg_map = dict(transaction_repo.sum_by_category(session, tx_type, avg_start, avg_end))
        all_ids: set[int] = {
            cid for cid in (set(current_map) | set(avg_map)) if cid is not None
        }
        parent_cat_ids = {
            cid
            for cid in all_ids
            if cid in categories and categories[cid].parent_id is None
        }
        rows = [
            _build_row(cid, current_map.get(cid, Decimal(0)), avg_map.get(cid, Decimal(0)))
            for cid in parent_cat_ids
        ]
    else:
        current_map_sub = dict(
            transaction_repo.sum_subcategories_for_category(
                session, tx_type, current_start, current_end, parent_id
            )
        )
        avg_map_sub = dict(
            transaction_repo.sum_subcategories_for_category(
                session, tx_type, avg_start, avg_end, parent_id
            )
        )
        all_ids_sub: set[int] = {
            sid for sid in (set(current_map_sub) | set(avg_map_sub)) if sid is not None
        }
        rows = [
            _build_row(sid, current_map_sub.get(sid, Decimal(0)), avg_map_sub.get(sid, Decimal(0)))
            for sid in all_ids_sub
            if sid in categories
        ]

    rows.sort(key=lambda r: r.current_amount, reverse=True)
    return rows


def _years_ago(today: dt.date, n: int) -> dt.date:
    try:
        return today.replace(year=today.year - n)
    except ValueError:
        return today.replace(year=today.year - n, day=28)


def get_balance_history(session: Session, period: str) -> list[BalancePoint]:
    """Cumulative balance evolution for the given period (1M, 3M, 1A, 5A).

    Resolution: daily for 1M/3M, monthly for 1A/5A.
    Starting point is the cumulative net of all transactions before the period start.
    """
    today = dt.date.today()

    if period == "1M":
        start = today - dt.timedelta(days=30)
        monthly = False
    elif period == "3M":
        start = today - dt.timedelta(days=90)
        monthly = False
    elif period == "5A":
        start = _years_ago(today, 5)
        monthly = True
    else:  # "1A" (default)
        start = _years_ago(today, 1)
        monthly = True

    opening = transaction_repo.cumulative_net_before(session, start)
    daily_nets: dict[dt.date, Decimal] = dict(transaction_repo.net_by_day(session, start, today))

    if not monthly:
        # One point per day
        points: list[BalancePoint] = []
        cumbal = opening
        cursor = start
        while cursor <= today:
            cumbal += daily_nets.get(cursor, Decimal(0))
            points.append(BalancePoint(date=str(cursor), balance=float(cumbal)))
            cursor += dt.timedelta(days=1)
        return points

    # Group daily nets into calendar months
    monthly_nets: dict[str, Decimal] = {}
    cursor = start
    while cursor <= today:
        key = cursor.strftime("%Y-%m")
        monthly_nets[key] = monthly_nets.get(key, Decimal(0)) + daily_nets.get(cursor, Decimal(0))
        cursor += dt.timedelta(days=1)

    points = []
    cumbal = opening
    for key in sorted(monthly_nets):
        cumbal += monthly_nets[key]
        points.append(BalancePoint(date=f"{key}-01", balance=float(cumbal)))
    return points
