"""Business logic for transactions: validation and CRUD orchestration."""

import datetime as dt

from sqlmodel import Session

from app.models import Transaction
from app.models.enums import TransactionType
from app.repositories import account as account_repo
from app.repositories import categorization_rule as rule_repo
from app.repositories import category as category_repo
from app.repositories import transaction as transaction_repo
from app.schemas.transaction import TransactionCreate, TransactionUpdate
from app.services.exceptions import NotFoundError, ValidationError


def _validate_refs(
    session: Session,
    *,
    transaction_type: TransactionType,
    account_id: int,
    transfer_account_id: int | None,
    category_id: int | None,
    subcategory_id: int | None,
) -> None:
    if account_repo.get(session, account_id) is None:
        raise NotFoundError("La cuenta indicada no existe.")

    if transaction_type == TransactionType.transfer:
        if transfer_account_id is None:
            raise ValidationError("transfer_account_id es obligatorio para transferencias.")
        if account_repo.get(session, transfer_account_id) is None:
            raise NotFoundError("La cuenta destino indicada no existe.")
        return

    category = None
    if category_id is not None:
        category = category_repo.get(session, category_id)
        if category is None:
            raise NotFoundError("La categoría indicada no existe.")
        if category.parent_id is not None:
            raise ValidationError("category_id debe ser una categoría principal.")
        if category.type != transaction_type:
            raise ValidationError("La categoría no coincide con el tipo del movimiento.")

    if subcategory_id is not None:
        subcategory = category_repo.get(session, subcategory_id)
        if subcategory is None:
            raise NotFoundError("La subcategoría indicada no existe.")
        if subcategory.parent_id is None:
            raise ValidationError("subcategory_id debe ser una subcategoría.")
        if category_id is not None and subcategory.parent_id != category_id:
            raise ValidationError("La subcategoría no pertenece a la categoría indicada.")
        if subcategory.type != transaction_type:
            raise ValidationError("La subcategoría no coincide con el tipo del movimiento.")


def resolve_category(session: Session, data: TransactionCreate) -> tuple[int | None, int | None]:
    """Return the (category, subcategory) the movement ends up with.

    Auto-categorizes from the rules when a concept is given and no category was
    set manually. Exposed so the CSV import preview can show exactly what the
    import will store without writing anything.
    """
    if data.category_id is not None or not data.concept:
        return data.category_id, data.subcategory_id

    rule = rule_repo.find_match(session, data.concept)
    if rule is None:
        return data.category_id, data.subcategory_id

    subcategory_id = data.subcategory_id if data.subcategory_id is not None else rule.subcategory_id
    return rule.category_id, subcategory_id


def build_transaction(session: Session, data: TransactionCreate) -> Transaction:
    """Validate a payload and return an unsaved ``Transaction``.

    Split out from :func:`create_transaction` so a bulk import can validate each
    row on its own — reporting the bad ones by line — and still write the good
    ones in a single commit.
    """
    dump = data.model_dump()
    dump["category_id"], dump["subcategory_id"] = resolve_category(session, data)

    _validate_refs(
        session,
        transaction_type=data.type,
        account_id=data.account_id,
        transfer_account_id=data.transfer_account_id,
        category_id=dump["category_id"],
        subcategory_id=dump["subcategory_id"],
    )
    return Transaction(**dump)


def create_transaction(session: Session, data: TransactionCreate) -> Transaction:
    return transaction_repo.create(session, build_transaction(session, data))


def get_transaction(session: Session, transaction_id: int) -> Transaction:
    transaction = transaction_repo.get(session, transaction_id)
    if transaction is None:
        raise NotFoundError("El movimiento indicado no existe.")
    return transaction


def list_transactions(
    session: Session,
    start: dt.date | None = None,
    end: dt.date | None = None,
    limit: int | None = None,
    transaction_type: TransactionType | None = None,
    category_id: int | None = None,
    subcategory_id: int | None = None,
    account_id: int | None = None,
    search: str | None = None,
    tag_id: int | None = None,
    no_category: bool = False,
    no_subcategory: bool = False,
) -> list[Transaction]:
    return transaction_repo.list_(
        session,
        start,
        end,
        limit,
        transaction_type=transaction_type,
        category_id=category_id,
        subcategory_id=subcategory_id,
        account_id=account_id,
        search=search,
        tag_id=tag_id,
        no_category=no_category,
        no_subcategory=no_subcategory,
    )


def update_transaction(
    session: Session, transaction_id: int, data: TransactionUpdate
) -> Transaction:
    transaction = get_transaction(session, transaction_id)
    changes = data.model_dump(exclude_unset=True)

    merged = {
        "transaction_type": changes.get("type", transaction.type),
        "account_id": changes.get("account_id", transaction.account_id),
        "transfer_account_id": changes.get("transfer_account_id", transaction.transfer_account_id),
        "category_id": changes.get("category_id", transaction.category_id),
        "subcategory_id": changes.get("subcategory_id", transaction.subcategory_id),
    }
    _validate_refs(session, **merged)

    for field, value in changes.items():
        setattr(transaction, field, value)
    return transaction_repo.update(session, transaction)


def delete_transaction(session: Session, transaction_id: int) -> None:
    transaction = get_transaction(session, transaction_id)
    transaction_repo.delete(session, transaction)
