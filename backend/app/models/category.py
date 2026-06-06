"""Category model. Subcategories are categories with a ``parent_id`` set."""

from typing import Optional

from sqlmodel import Field, Relationship, SQLModel

from app.models.enums import CategoryType


class Category(SQLModel, table=True):
    __tablename__ = "categories"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    type: CategoryType
    parent_id: int | None = Field(default=None, foreign_key="categories.id", index=True)
    color: str | None = Field(default=None, max_length=9)
    icon: str | None = Field(default=None)

    parent: Optional["Category"] = Relationship(
        back_populates="children",
        sa_relationship_kwargs={"remote_side": "Category.id"},
    )
    children: list["Category"] = Relationship(back_populates="parent")
