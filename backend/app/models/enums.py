"""Enumerations shared by the data models."""

from enum import StrEnum


class AccountType(StrEnum):
    cash = "cash"
    bank = "bank"
    card = "card"
    savings = "savings"


class CategoryType(StrEnum):
    income = "income"
    expense = "expense"


class TransactionType(StrEnum):
    income = "income"
    expense = "expense"
    transfer = "transfer"


class BudgetPeriod(StrEnum):
    monthly = "monthly"
    yearly = "yearly"


class RecurrenceFrequency(StrEnum):
    daily = "daily"
    weekly = "weekly"
    monthly = "monthly"
    yearly = "yearly"
