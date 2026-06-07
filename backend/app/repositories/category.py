"""Data access for categories."""

from sqlmodel import Session, col, select

from app.models import Category


def exists(session: Session) -> bool:
    """Return whether at least one category is stored."""
    return session.exec(select(Category.id).limit(1)).first() is not None


def get(session: Session, category_id: int) -> Category | None:
    """Return a category by id, or ``None`` if it does not exist."""
    return session.get(Category, category_id)


def list_all(session: Session) -> list[Category]:
    """Return all categories ordered by name."""
    return list(session.exec(select(Category).order_by(col(Category.name))).all())


def add_all(session: Session, categories: list[Category]) -> None:
    """Persist several categories in a single transaction."""
    session.add_all(categories)
    session.commit()
