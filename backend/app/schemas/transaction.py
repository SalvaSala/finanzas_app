"""API DTOs for transactions and CSV import results."""

import datetime as dt
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import TransactionType
from app.schemas.tag import TagRead


class TransactionCreate(BaseModel):
    date: dt.date
    type: TransactionType
    concept: str = Field(min_length=1, max_length=200)
    description: str | None = None
    amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    category_id: int | None = None
    subcategory_id: int | None = None
    account_id: int
    transfer_account_id: int | None = None

    @model_validator(mode="after")
    def validate_transfer_fields(self) -> "TransactionCreate":
        if self.type == TransactionType.transfer:
            if self.transfer_account_id is None:
                raise ValueError("transfer_account_id es obligatorio para transferencias.")
            if self.transfer_account_id == self.account_id:
                raise ValueError("Las cuentas de origen y destino deben ser distintas.")
        else:
            if self.transfer_account_id is not None:
                raise ValueError("transfer_account_id solo aplica a transferencias.")
        return self


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
    transfer_account_id: int | None = None


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
    transfer_account_id: int | None
    recurring_id: int | None
    created_at: dt.datetime
    tags: list[TagRead] = []


class ImportResult(BaseModel):
    imported: int
    skipped: int
    errors: list[str]


class ConceptSuggestion(BaseModel):
    concept: str
    category_id: int | None
    subcategory_id: int | None
