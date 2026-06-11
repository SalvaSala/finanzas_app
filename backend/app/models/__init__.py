"""SQLModel data models.

Importing this package registers every table on ``SQLModel.metadata`` (used by
Alembic autogenerate and by tests that create the schema).
"""

from app.models.account import Account
from app.models.budget import Budget
from app.models.categorization_rule import CategorizationRule
from app.models.category import Category
from app.models.enums import (
    AccountType,
    BudgetPeriod,
    CategoryType,
    RecurrenceFrequency,
    TransactionType,
)
from app.models.recurring import RecurringTransaction
from app.models.savings_goal import SavingsGoal
from app.models.tag import Tag, transaction_tags_table
from app.models.transaction import Transaction

__all__ = [
    "Account",
    "Budget",
    "CategorizationRule",
    "Category",
    "RecurringTransaction",
    "SavingsGoal",
    "Tag",
    "Transaction",
    "transaction_tags_table",
    "AccountType",
    "BudgetPeriod",
    "CategoryType",
    "RecurrenceFrequency",
    "TransactionType",
]
