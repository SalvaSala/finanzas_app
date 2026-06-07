"""Data access for categories."""

from sqlmodel import Session, select

from app.models import Category


def exists(session: Session) -> bool:
    """Return whether at least one category is stored."""
    return session.exec(select(Category.id).limit(1)).first() is not None


def add_all(session: Session, categories: list[Category]) -> None:
    """Persist several categories in a single transaction."""
    session.add_all(categories)
    session.commit()
