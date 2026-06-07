"""Transaction model: a single income or expense movement.

``amount`` is always stored positive; the sign/color in the UI is derived from
``type`` (expenses red/negative, income green). Never use float for money.
"""

import datetime as dt
from decimal import Decimal
from typing import TYPE_CHECKING, Optional

from sqlalchemy import CheckConstraint
from sqlmodel import Field, Relationship, SQLModel

from app.models.enums import TransactionType

if TYPE_CHECKING:
    from app.models.account import Account
    from app.models.category import Category


class Transaction(SQLModel, table=True):
    __tablename__ = "transactions"
    __table_args__ = (CheckConstraint("amount > 0", name="ck_transactions_amount_positive"),)

    id: int | None = Field(default=None, primary_key=True)
    date: dt.date = Field(index=True)
    type: TransactionType = Field(index=True)
    concept: str = Field(index=True)
    description: str | None = Field(default=None)
    amount: Decimal = Field(max_digits=14, decimal_places=2)
    category_id: int | None = Field(default=None, foreign_key="categories.id", index=True)
    subcategory_id: int | None = Field(default=None, foreign_key="categories.id", index=True)
    account_id: int = Field(foreign_key="accounts.id", index=True)
    transfer_account_id: int | None = Field(default=None, foreign_key="accounts.id", index=True)
    created_at: dt.datetime = Field(default_factory=lambda: dt.datetime.now(dt.UTC))

    account: Optional["Account"] = Relationship(
        sa_relationship_kwargs={
            "foreign_keys": "[Transaction.account_id]",
            "primaryjoin": "Account.id == Transaction.account_id",
        },
        back_populates="transactions",
    )
    transfer_account: Optional["Account"] = Relationship(
        sa_relationship_kwargs={
            "foreign_keys": "[Transaction.transfer_account_id]",
            "primaryjoin": "Account.id == Transaction.transfer_account_id",
        },
    )
    category: Optional["Category"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "Transaction.category_id"}
    )
    subcategory: Optional["Category"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "Transaction.subcategory_id"}
    )
