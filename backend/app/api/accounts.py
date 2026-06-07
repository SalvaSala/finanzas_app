"""Read endpoints for accounts."""

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.core.db import get_session
from app.models import Account
from app.repositories import account as account_repo
from app.schemas import AccountRead

router = APIRouter(prefix="/accounts", tags=["accounts"])


@router.get("", response_model=list[AccountRead])
def list_accounts(session: Session = Depends(get_session)) -> list[Account]:
    return account_repo.list_all(session)
