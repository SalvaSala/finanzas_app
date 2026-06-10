"""Data access for tags."""

from sqlmodel import Session, col, select

from app.models.tag import Tag


def create(session: Session, tag: Tag) -> Tag:
    session.add(tag)
    session.commit()
    session.refresh(tag)
    return tag


def get(session: Session, tag_id: int) -> Tag | None:
    return session.get(Tag, tag_id)


def get_by_name(session: Session, name: str) -> Tag | None:
    return session.exec(select(Tag).where(col(Tag.name) == name)).first()


def list_all(session: Session) -> list[Tag]:
    return list(session.exec(select(Tag).order_by(col(Tag.name))).all())


def update(session: Session, tag: Tag) -> Tag:
    session.add(tag)
    session.commit()
    session.refresh(tag)
    return tag


def delete(session: Session, tag: Tag) -> None:
    session.delete(tag)
    session.commit()
