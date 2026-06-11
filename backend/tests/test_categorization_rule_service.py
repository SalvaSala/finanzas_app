"""Tests for categorization rules service + auto-categorization hook."""

import datetime as dt
from decimal import Decimal

import pytest
from sqlmodel import Session

from app.models import Account, AccountType, Category, CategoryType
from app.schemas.categorization_rule import (
    CategorizationRuleCreate,
    CategorizationRuleUpdate,
)
from app.schemas.transaction import TransactionCreate
from app.services import categorization_rule as svc
from app.services import transaction as tx_svc
from app.services.exceptions import NotFoundError, ValidationError


def _setup(session: Session) -> tuple[Account, Category, Category]:
    account = Account(name="Banco", type=AccountType.bank)
    food = Category(name="Alimentación", type=CategoryType.expense)
    salary = Category(name="Nómina", type=CategoryType.income)
    session.add_all([account, food, salary])
    session.commit()
    for obj in (account, food, salary):
        session.refresh(obj)
    market = Category(name="Supermercado", type=CategoryType.expense, parent_id=food.id)
    session.add(market)
    session.commit()
    session.refresh(market)
    return account, food, market


def test_create_and_list(session: Session) -> None:
    _, food, _ = _setup(session)
    assert food.id is not None
    svc.create_rule(session, CategorizationRuleCreate(pattern="mercadona", category_id=food.id))
    svc.create_rule(session, CategorizationRuleCreate(pattern="lidl", category_id=food.id))
    rules = svc.list_rules(session)
    assert len(rules) == 2


def test_create_with_subcategory(session: Session) -> None:
    _, food, market = _setup(session)
    assert food.id is not None and market.id is not None
    rule = svc.create_rule(
        session,
        CategorizationRuleCreate(
            pattern="carrefour", category_id=food.id, subcategory_id=market.id
        ),
    )
    assert rule.subcategory_id == market.id


def test_create_invalid_category(session: Session) -> None:
    with pytest.raises(NotFoundError):
        svc.create_rule(session, CategorizationRuleCreate(pattern="x", category_id=999))


def test_create_subcategory_as_parent_raises(session: Session) -> None:
    _, food, market = _setup(session)
    assert market.id is not None
    # market is a subcategory → cannot be used as category_id
    with pytest.raises(ValidationError):
        svc.create_rule(session, CategorizationRuleCreate(pattern="x", category_id=market.id))


def test_get_unknown_raises(session: Session) -> None:
    with pytest.raises(NotFoundError):
        svc.get_rule(session, 999)


def test_update_pattern(session: Session) -> None:
    _, food, _ = _setup(session)
    assert food.id is not None
    rule = svc.create_rule(
        session, CategorizationRuleCreate(pattern="mercadona", category_id=food.id)
    )
    updated = svc.update_rule(session, rule.id, CategorizationRuleUpdate(pattern="MERCADONA ES"))
    assert updated.pattern == "MERCADONA ES"


def test_update_disable(session: Session) -> None:
    _, food, _ = _setup(session)
    assert food.id is not None
    rule = svc.create_rule(
        session, CategorizationRuleCreate(pattern="mercadona", category_id=food.id)
    )
    updated = svc.update_rule(session, rule.id, CategorizationRuleUpdate(enabled=False))
    assert updated.enabled is False


def test_delete(session: Session) -> None:
    _, food, _ = _setup(session)
    assert food.id is not None
    rule = svc.create_rule(
        session, CategorizationRuleCreate(pattern="mercadona", category_id=food.id)
    )
    svc.delete_rule(session, rule.id)
    with pytest.raises(NotFoundError):
        svc.get_rule(session, rule.id)


def test_suggest_matches(session: Session) -> None:
    _, food, _ = _setup(session)
    assert food.id is not None
    svc.create_rule(session, CategorizationRuleCreate(pattern="mercadona", category_id=food.id))
    result = svc.suggest(session, "Compra Mercadona Online")
    assert result is not None
    assert result.category_id == food.id


def test_suggest_no_match(session: Session) -> None:
    _, food, _ = _setup(session)
    assert food.id is not None
    svc.create_rule(session, CategorizationRuleCreate(pattern="mercadona", category_id=food.id))
    assert svc.suggest(session, "Gasolinera Repsol") is None


def test_suggest_disabled_rule_not_matched(session: Session) -> None:
    _, food, _ = _setup(session)
    assert food.id is not None
    rule = svc.create_rule(
        session, CategorizationRuleCreate(pattern="mercadona", category_id=food.id)
    )
    svc.update_rule(session, rule.id, CategorizationRuleUpdate(enabled=False))
    assert svc.suggest(session, "Mercadona") is None


def test_autocategorize_on_create(session: Session) -> None:
    account, food, _ = _setup(session)
    assert account.id is not None and food.id is not None
    svc.create_rule(session, CategorizationRuleCreate(pattern="mercadona", category_id=food.id))
    tx = tx_svc.create_transaction(
        session,
        TransactionCreate(
            date=dt.date(2026, 6, 1),
            type=CategoryType.expense.value,
            concept="Mercadona Compra Semanal",
            amount=Decimal("55.00"),
            account_id=account.id,
        ),
    )
    assert tx.category_id == food.id


def test_manual_category_not_overridden(session: Session) -> None:
    account, food, _ = _setup(session)
    assert account.id is not None and food.id is not None
    salary = Category(name="Nómina", type=CategoryType.expense)
    session.add(salary)
    session.commit()
    session.refresh(salary)
    svc.create_rule(session, CategorizationRuleCreate(pattern="mercadona", category_id=food.id))
    tx = tx_svc.create_transaction(
        session,
        TransactionCreate(
            date=dt.date(2026, 6, 1),
            type=CategoryType.expense.value,
            concept="Mercadona",
            amount=Decimal("30.00"),
            account_id=account.id,
            category_id=salary.id,
        ),
    )
    assert tx.category_id == salary.id
