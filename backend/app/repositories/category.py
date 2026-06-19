"""Data access for categories."""

from sqlalchemy import func, or_
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


def count_children(session: Session, category_id: int) -> int:
    result = session.exec(
        select(func.count()).select_from(Category).where(col(Category.parent_id) == category_id)
    ).one()
    return int(result)


def count_affected_transactions(session: Session, category_id: int) -> int:
    """Count transactions that reference this category or any of its subcategories."""
    child_ids = list(
        session.exec(select(Category.id).where(col(Category.parent_id) == category_id)).all()
    )
    all_ids = [category_id, *child_ids]
    result = session.exec(
        select(func.count())
        .select_from(Transaction)
        .where(
            or_(
                col(Transaction.category_id).in_(all_ids),
                col(Transaction.subcategory_id).in_(all_ids),
            )
        )
    ).one()
    return int(result)


def cascade_delete(session: Session, category_id: int) -> None:
    """Delete a category and its subcategories, desassigning affected transactions."""
    children = list(
        session.exec(select(Category).where(col(Category.parent_id) == category_id)).all()
    )
    for child in children:
        for tx in session.exec(
            select(Transaction).where(col(Transaction.subcategory_id) == child.id)
        ).all():
            tx.subcategory_id = None
            session.add(tx)
        session.delete(child)

    for tx in session.exec(
        select(Transaction).where(
            (col(Transaction.category_id) == category_id)
            | (col(Transaction.subcategory_id) == category_id)
        )
    ).all():
        tx.category_id = None
        tx.subcategory_id = None
        session.add(tx)

    category = session.get(Category, category_id)
    if category:
        session.delete(category)
    session.commit()
