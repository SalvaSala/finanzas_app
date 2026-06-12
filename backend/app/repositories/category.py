"""Data access for categories."""

from sqlmodel import Session, col, select

from app.models import Category, Transaction


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


def create(session: Session, category: Category) -> Category:
    session.add(category)
    session.commit()
    session.refresh(category)
    return category


def update(session: Session, category: Category) -> Category:
    session.add(category)
    session.commit()
    session.refresh(category)
    return category


def delete(session: Session, category: Category) -> None:
    session.delete(category)
    session.commit()


def has_children(session: Session, category_id: int) -> bool:
    return (
        session.exec(
            select(Category.id).where(col(Category.parent_id) == category_id).limit(1)
        ).first()
        is not None
    )


def has_transactions(session: Session, category_id: int) -> bool:
    return (
        session.exec(
            select(Transaction.id)
            .where(
                (col(Transaction.category_id) == category_id)
                | (col(Transaction.subcategory_id) == category_id)
            )
            .limit(1)
        ).first()
        is not None
    )
