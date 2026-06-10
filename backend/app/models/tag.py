"""Tag model and the N:M junction with Transaction.

Tags are free-form labels orthogonal to categories (e.g. "vacaciones",
"deducible"). A transaction can have many tags; a tag can appear on many
transactions.
"""

import sqlalchemy as sa
from sqlmodel import Field, SQLModel

# Junction table (plain SQLAlchemy Table, not a SQLModel class, to avoid
# registering it as a first-class model and to keep the N:M wiring simple).
transaction_tags_table = sa.Table(
    "transaction_tags",
    SQLModel.metadata,
    sa.Column(
        "transaction_id",
        sa.Integer,
        sa.ForeignKey("transactions.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    sa.Column(
        "tag_id",
        sa.Integer,
        sa.ForeignKey("tags.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class Tag(SQLModel, table=True):
    __tablename__ = "tags"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)
    color: str | None = Field(default=None)
