"""CRUD endpoints for categories and subcategories."""

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.core.db import get_session
from app.models import Category
from app.repositories import category as category_repo
from app.schemas import CategoryCreate, CategoryRead, CategoryUpdate

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryRead])
def list_categories(session: Session = Depends(get_session)) -> list[Category]:
    return category_repo.list_all(session)


@router.post("", response_model=CategoryRead, status_code=201)
def create_category(body: CategoryCreate, session: Session = Depends(get_session)) -> Category:
    if body.parent_id is not None:
        parent = category_repo.get(session, body.parent_id)
        if parent is None:
            raise HTTPException(status_code=404, detail="Categoría padre no encontrada")
        if parent.type != body.type:
            raise HTTPException(
                status_code=422,
                detail="La subcategoría debe ser del mismo tipo que su padre",
            )
        if parent.parent_id is not None:
            raise HTTPException(
                status_code=422,
                detail="No se pueden crear subcategorías de subcategorías",
            )
    category = Category(
        name=body.name,
        type=body.type,
        parent_id=body.parent_id,
        color=body.color,
        icon=body.icon,
    )
    return category_repo.create(session, category)


@router.patch("/{category_id}", response_model=CategoryRead)
def update_category(
    category_id: int,
    body: CategoryUpdate,
    session: Session = Depends(get_session),
) -> Category:
    category = category_repo.get(session, category_id)
    if category is None:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    if body.name is not None:
        category.name = body.name
    if body.color is not None:
        category.color = body.color
    if body.icon is not None:
        category.icon = body.icon
    return category_repo.update(session, category)


@router.delete("/{category_id}", status_code=204)
def delete_category(
    category_id: int,
    session: Session = Depends(get_session),
) -> None:
    category = category_repo.get(session, category_id)
    if category is None:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    if category_repo.has_children(session, category_id):
        raise HTTPException(
            status_code=409,
            detail="Elimina primero las subcategorías de esta categoría",
        )
    if category_repo.has_transactions(session, category_id):
        raise HTTPException(
            status_code=409,
            detail="Hay movimientos asignados a esta categoría",
        )
    category_repo.delete(session, category)
