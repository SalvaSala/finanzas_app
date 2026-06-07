"""Business logic for the dashboard: KPIs and per-category breakdowns.

All aggregations are computed in the database (see ``repositories.transaction``);
this layer only resolves category names/colors and assembles the response.
"""

from decimal import Decimal

from sqlmodel import Session

from app.models.enums import TransactionType
from app.repositories import category as category_repo
from app.repositories import transaction as transaction_repo
from app.schemas.dashboard import CategoryAmount, DashboardSummary
from app.services.periods import period_range

UNCATEGORIZED_LABEL = "Sin categoría"


def get_summary(session: Session, year: int, month: int | None) -> DashboardSummary:
    start, end = period_range(year, month)

    income = transaction_repo.total_by_type(session, TransactionType.income, start, end)
    expense = transaction_repo.total_by_type(session, TransactionType.expense, start, end)

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
        balance=Decimal(income - expense),
        expense_by_category=breakdown(TransactionType.expense),
        income_by_category=breakdown(TransactionType.income),
    )
