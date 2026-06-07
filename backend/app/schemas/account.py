"""API DTOs for accounts."""

from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.models.enums import AccountType


class AccountRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    type: AccountType
    currency: str
    initial_balance: Decimal
    archived: bool
