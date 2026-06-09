"""SQLModel data models.

Importing this package registers every table on ``SQLModel.metadata`` (used by
Alembic autogenerate and by tests that create the schema).
"""

from app.models.account import Account
from app.models.budget import Budget
from app.models.category import Category
from app.models.enums import (
    AccountType,
    BudgetPeriod,
    CategoryType,
    RecurrenceFrequency,
    TransactionType,
)
from app.models.recurring import RecurringTransaction
from app.models.transaction import Transaction

__all__ = [
    "Account",
    "Budget",
    "Category",
    "RecurringTransaction",
    "Transaction",
    "AccountType",
    "BudgetPeriod",
    "CategoryType",
    "RecurrenceFrequency",
    "TransactionType",
]
