"""CRUD endpoints for tags."""

from fastapi import APIRouter, Depends, status
from sqlmodel import Session

from app.core.db import get_session
from app.models.tag import Tag
from app.schemas.tag import TagCreate, TagRead, TagUpdate
from app.services import tag as tag_service

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("", response_model=list[TagRead])
def list_tags(session: Session = Depends(get_session)) -> list[Tag]:
    return tag_service.list_tags(session)


@router.post("", response_model=TagRead, status_code=status.HTTP_201_CREATED)
def create_tag(data: TagCreate, session: Session = Depends(get_session)) -> Tag:
    return tag_service.create_tag(session, data)


@router.get("/{tag_id}", response_model=TagRead)
def get_tag(tag_id: int, session: Session = Depends(get_session)) -> Tag:
    return tag_service.get_tag(session, tag_id)


@router.patch("/{tag_id}", response_model=TagRead)
def update_tag(tag_id: int, data: TagUpdate, session: Session = Depends(get_session)) -> Tag:
    return tag_service.update_tag(session, tag_id, data)


@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tag(tag_id: int, session: Session = Depends(get_session)) -> None:
    tag_service.delete_tag(session, tag_id)
