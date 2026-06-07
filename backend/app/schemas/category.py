"""API DTOs for categories."""

from pydantic import BaseModel, ConfigDict

from app.models.enums import CategoryType


class CategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    type: CategoryType
    parent_id: int | None
    color: str | None
    icon: str | None
