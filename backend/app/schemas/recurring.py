"""API DTOs for recurring transactions."""

import datetime as dt
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import RecurrenceFrequency, TransactionType


class RecurringCreate(BaseModel):
    type: TransactionType
    concept: str = Field(min_length=1, max_length=200)
    description: str | None = None
    amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    category_id: int | None = None
    subcategory_id: int | None = None
    account_id: int
    transfer_account_id: int | None = None
    frequency: RecurrenceFrequency
    interval: int = Field(default=1, gt=0)
    start_date: dt.date
    end_date: dt.date | None = None

    @model_validator(mode="after")
    def validate_fields(self) -> "RecurringCreate":
        if self.type == TransactionType.transfer:
            if self.transfer_account_id is None:
                raise ValueError("transfer_account_id es obligatorio para transferencias.")
            if self.transfer_account_id == self.account_id:
                raise ValueError("Las cuentas de origen y destino deben ser distintas.")
        else:
            if self.transfer_account_id is not None:
                raise ValueError("transfer_account_id solo aplica a transferencias.")
        if self.end_date is not None and self.end_date < self.start_date:
            raise ValueError("La fecha de fin no puede ser anterior a la de inicio.")
        return self


class RecurringUpdate(BaseModel):
    """Partial update. Only fields present in the request are applied."""

    concept: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    amount: Decimal | None = Field(default=None, gt=0, max_digits=14, decimal_places=2)
    category_id: int | None = None
    subcategory_id: int | None = None
    account_id: int | None = None
    transfer_account_id: int | None = None
    frequency: RecurrenceFrequency | None = None
    interval: int | None = Field(default=None, gt=0)
    start_date: dt.date | None = None
    end_date: dt.date | None = None
    active: bool | None = None


class RecurringRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    type: TransactionType
    concept: str
    description: str | None
    amount: Decimal
    category_id: int | None
    subcategory_id: int | None
    account_id: int
    transfer_account_id: int | None
    frequency: RecurrenceFrequency
    interval: int
    start_date: dt.date
    end_date: dt.date | None
    next_run_date: dt.date
    active: bool
    created_at: dt.datetime


class RecurringRunResult(BaseModel):
    generated: int
