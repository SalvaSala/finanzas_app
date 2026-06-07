"""API DTOs for transactions."""

import datetime as dt
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import TransactionType


class TransactionCreate(BaseModel):
    date: dt.date
    type: TransactionType
    concept: str = Field(min_length=1, max_length=200)
    description: str | None = None
    amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    category_id: int | None = None
    subcategory_id: int | None = None
    account_id: int


class TransactionUpdate(BaseModel):
    """Partial update. Only fields present in the request are applied."""

    date: dt.date | None = None
    type: TransactionType | None = None
    concept: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    amount: Decimal | None = Field(default=None, gt=0, max_digits=14, decimal_places=2)
    category_id: int | None = None
    subcategory_id: int | None = None
    account_id: int | None = None


class TransactionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    date: dt.date
    type: TransactionType
    concept: str
    description: str | None
    amount: Decimal
    category_id: int | None
    subcategory_id: int | None
    account_id: int
    created_at: dt.datetime
