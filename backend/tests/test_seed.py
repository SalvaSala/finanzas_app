"""Tests for the initial seed data."""

from sqlmodel import Session, select

from app.models import Account, Category, CategoryType
from app.services.seed import (
    DEFAULT_ACCOUNTS,
    DEFAULT_CATEGORIES,
    seed_initial_data,
)


def _expected_category_count() -> int:
    return sum(1 + len(subs) for *_, subs in DEFAULT_CATEGORIES)


def test_seed_populates_accounts_and_categories(session: Session) -> None:
    created = seed_initial_data(session)

    assert created["accounts"] == len(DEFAULT_ACCOUNTS)
    assert created["categories"] == _expected_category_count()

    assert len(session.exec(select(Account)).all()) == len(DEFAULT_ACCOUNTS)
    assert len(session.exec(select(Category)).all()) == _expected_category_count()


def test_seed_is_idempotent(session: Session) -> None:
    seed_initial_data(session)
    second = seed_initial_data(session)

    assert second == {"accounts": 0, "categories": 0}
    assert len(session.exec(select(Account)).all()) == len(DEFAULT_ACCOUNTS)


def test_subcategories_reference_their_parent(session: Session) -> None:
    seed_initial_data(session)

    vivienda = session.exec(select(Category).where(Category.name == "Vivienda")).one()
    luz = session.exec(select(Category).where(Category.name == "Luz")).one()

    assert vivienda.parent_id is None
    assert luz.parent_id == vivienda.id
    assert luz.type == CategoryType.expense
    assert {child.name for child in vivienda.children} >= {"Luz", "Agua"}
