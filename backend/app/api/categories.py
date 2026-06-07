"""Read endpoints for categories."""

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.core.db import get_session
from app.models import Category
from app.repositories import category as category_repo
from app.schemas import CategoryRead

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryRead])
def list_categories(session: Session = Depends(get_session)) -> list[Category]:
    return category_repo.list_all(session)
