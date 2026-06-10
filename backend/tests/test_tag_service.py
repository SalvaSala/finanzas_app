"""Tests for the tag service (CRUD + attach/detach)."""

import datetime as dt
from decimal import Decimal

import pytest
from sqlmodel import Session

from app.models import Account, AccountType, Category, CategoryType, Transaction
from app.models.enums import TransactionType
from app.schemas.tag import TagCreate, TagUpdate
from app.services import tag as service
from app.services.exceptions import NotFoundError, ValidationError


def _make_tx(session: Session) -> Transaction:
    account = Account(name="Banco", type=AccountType.bank)
    cat = Category(name="Alimentación", type=CategoryType.expense)
    session.add_all([account, cat])
    session.commit()
    session.refresh(account)
    session.refresh(cat)
    tx = Transaction(
        date=dt.date(2026, 6, 1),
        type=TransactionType.expense,
        concept="Compra",
        amount=Decimal("20.00"),
        account_id=account.id,
        category_id=cat.id,
    )
    session.add(tx)
    session.commit()
    session.refresh(tx)
    return tx


def test_create_and_list(session: Session) -> None:
    service.create_tag(session, TagCreate(name="vacaciones", color="#3b82f6"))
    service.create_tag(session, TagCreate(name="deducible"))
    tags = service.list_tags(session)
    assert len(tags) == 2
    assert tags[0].name == "deducible"  # alphabetical


def test_duplicate_name_raises(session: Session) -> None:
    service.create_tag(session, TagCreate(name="vacaciones"))
    with pytest.raises(ValidationError):
        service.create_tag(session, TagCreate(name="vacaciones"))


def test_update_tag(session: Session) -> None:
    tag = service.create_tag(session, TagCreate(name="deducible"))
    assert tag.id is not None
    updated = service.update_tag(session, tag.id, TagUpdate(color="#22c55e"))
    assert updated.color == "#22c55e"
    assert updated.name == "deducible"


def test_delete_tag(session: Session) -> None:
    tag = service.create_tag(session, TagCreate(name="temp"))
    assert tag.id is not None
    service.delete_tag(session, tag.id)
    with pytest.raises(NotFoundError):
        service.get_tag(session, tag.id)


def test_attach_detach(session: Session) -> None:
    tx = _make_tx(session)
    tag = service.create_tag(session, TagCreate(name="vacaciones"))
    assert tx.id is not None and tag.id is not None
    tx_id, tag_id = tx.id, tag.id

    tx = service.attach_tag(session, tx_id, tag_id)
    assert any(t.id == tag_id for t in tx.tags)

    tx = service.detach_tag(session, tx_id, tag_id)
    assert not any(t.id == tag_id for t in tx.tags)


def test_set_tags_replaces_all(session: Session) -> None:
    tx = _make_tx(session)
    a = service.create_tag(session, TagCreate(name="a"))
    b = service.create_tag(session, TagCreate(name="b"))
    c = service.create_tag(session, TagCreate(name="c"))
    assert tx.id is not None and a.id is not None and b.id is not None and c.id is not None
    tx_id, a_id, b_id, c_id = tx.id, a.id, b.id, c.id

    tx = service.set_tags(session, tx_id, [a_id, b_id])
    assert len(tx.tags) == 2

    tx = service.set_tags(session, tx_id, [c_id])
    assert len(tx.tags) == 1
    assert tx.tags[0].name == "c"


def test_attach_idempotent(session: Session) -> None:
    tx = _make_tx(session)
    tag = service.create_tag(session, TagCreate(name="x"))
    assert tx.id is not None and tag.id is not None
    service.attach_tag(session, tx.id, tag.id)
    tx = service.attach_tag(session, tx.id, tag.id)
    assert len(tx.tags) == 1
