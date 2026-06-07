"""Data access for accounts."""

from sqlmodel import Session, col, select

from app.models import Account


def exists(session: Session) -> bool:
    """Return whether at least one account is stored."""
    return session.exec(select(Account.id).limit(1)).first() is not None


def get(session: Session, account_id: int) -> Account | None:
    """Return an account by id, or ``None`` if it does not exist."""
    return session.get(Account, account_id)


def list_all(session: Session) -> list[Account]:
    """Return all accounts ordered by name."""
    return list(session.exec(select(Account).order_by(col(Account.name))).all())


def add_all(session: Session, accounts: list[Account]) -> None:
    """Persist several accounts in a single transaction."""
    session.add_all(accounts)
    session.commit()
