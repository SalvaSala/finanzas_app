"""Business logic for tags: CRUD and attach/detach to transactions."""

from sqlmodel import Session

from app.models import Transaction
from app.models.tag import Tag
from app.repositories import tag as tag_repo
from app.repositories import transaction as transaction_repo
from app.schemas.tag import TagCreate, TagUpdate
from app.services.exceptions import NotFoundError, ValidationError


def create_tag(session: Session, data: TagCreate) -> Tag:
    if tag_repo.get_by_name(session, data.name) is not None:
        raise ValidationError(f"Ya existe una etiqueta con el nombre '{data.name}'.")
    tag = Tag(**data.model_dump())
    return tag_repo.create(session, tag)


def get_tag(session: Session, tag_id: int) -> Tag:
    tag = tag_repo.get(session, tag_id)
    if tag is None:
        raise NotFoundError("La etiqueta indicada no existe.")
    return tag


def list_tags(session: Session) -> list[Tag]:
    return tag_repo.list_all(session)


def update_tag(session: Session, tag_id: int, data: TagUpdate) -> Tag:
    tag = get_tag(session, tag_id)
    changes = data.model_dump(exclude_unset=True)
    if "name" in changes and changes["name"] != tag.name:
        if tag_repo.get_by_name(session, changes["name"]) is not None:
            raise ValidationError(f"Ya existe una etiqueta con el nombre '{changes['name']}'.")
    for field, value in changes.items():
        setattr(tag, field, value)
    return tag_repo.update(session, tag)


def delete_tag(session: Session, tag_id: int) -> None:
    tag = get_tag(session, tag_id)
    tag_repo.delete(session, tag)


def _get_transaction(session: Session, transaction_id: int) -> Transaction:
    tx = transaction_repo.get(session, transaction_id)
    if tx is None:
        raise NotFoundError("El movimiento indicado no existe.")
    return tx


def attach_tag(session: Session, transaction_id: int, tag_id: int) -> Transaction:
    tx = _get_transaction(session, transaction_id)
    tag = get_tag(session, tag_id)
    if tag not in tx.tags:
        tx.tags.append(tag)
        session.add(tx)
        session.commit()
        session.refresh(tx)
    return tx


def detach_tag(session: Session, transaction_id: int, tag_id: int) -> Transaction:
    tx = _get_transaction(session, transaction_id)
    tag = get_tag(session, tag_id)
    if tag in tx.tags:
        tx.tags.remove(tag)
        session.add(tx)
        session.commit()
        session.refresh(tx)
    return tx


def set_tags(session: Session, transaction_id: int, tag_ids: list[int]) -> Transaction:
    """Replace all tags on a transaction with the given list."""
    tx = _get_transaction(session, transaction_id)
    tags = [get_tag(session, tid) for tid in tag_ids]
    tx.tags = tags
    session.add(tx)
    session.commit()
    session.refresh(tx)
    return tx
