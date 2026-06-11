"""Pydantic / SQLModel schemas for CategorizationRule."""

from pydantic import Field
from sqlmodel import SQLModel


class CategorizationRuleCreate(SQLModel):
    pattern: str = Field(min_length=1, max_length=200)
    category_id: int
    subcategory_id: int | None = None
    priority: int = 0
    enabled: bool = True


class CategorizationRuleUpdate(SQLModel):
    pattern: str | None = Field(default=None, min_length=1, max_length=200)
    category_id: int | None = None
    subcategory_id: int | None = None
    priority: int | None = None
    enabled: bool | None = None


class CategorizationRuleRead(SQLModel):
    id: int
    pattern: str
    category_id: int
    subcategory_id: int | None
    priority: int
    enabled: bool


class SuggestResponse(SQLModel):
    """Returned by the suggest endpoint when a rule matches."""

    rule_id: int
    category_id: int
    subcategory_id: int | None
