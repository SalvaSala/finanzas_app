"""Rule: if transaction concept contains *pattern* → assign category/subcategory."""

from sqlmodel import Field, SQLModel


class CategorizationRule(SQLModel, table=True):
    __tablename__ = "categorization_rules"

    id: int | None = Field(default=None, primary_key=True)
    pattern: str = Field(index=True)
    category_id: int = Field(foreign_key="categories.id")
    subcategory_id: int | None = Field(default=None, foreign_key="categories.id")
    priority: int = Field(default=0, index=True)
    enabled: bool = Field(default=True)
