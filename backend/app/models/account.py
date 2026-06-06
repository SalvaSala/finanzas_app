"""Account model: where money is held (cash, bank, card, savings)."""

from decimal import Decimal
from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship, SQLModel

from app.models.enums import AccountType

if TYPE_CHECKING:
    from app.models.transaction import Transaction


class Account(SQLModel, table=True):
    __tablename__ = "accounts"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    type: AccountType
    currency: str = Field(default="EUR", max_length=3)
    initial_balance: Decimal = Field(default=Decimal("0"), max_digits=14, decimal_places=2)
    archived: bool = Field(default=False)

    transactions: list["Transaction"] = Relationship(back_populates="account")
