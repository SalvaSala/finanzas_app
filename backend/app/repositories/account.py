"""Data access for accounts."""

from sqlmodel import Session, select

from app.models import Account


def exists(session: Session) -> bool:
    """Return whether at least one account is stored."""
    return session.exec(select(Account.id).limit(1)).first() is not None


def add_all(session: Session, accounts: list[Account]) -> None:
    """Persist several accounts in a single transaction."""
    session.add_all(accounts)
    session.commit()
