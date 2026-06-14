"""API DTOs for categories."""

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import CategoryType


class CategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    type: CategoryType
    parent_id: int | None
    color: str | None
    icon: str | None


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    type: CategoryType
    parent_id: int | None = None
    color: str | None = None
    icon: str | None = None


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=60)
    color: str | None = None
    icon: str | None = None


class CategoryDeleteInfo(BaseModel):
    subcategory_count: int
    transaction_count: int
