"""Data access for budgets."""

from sqlmodel import Session, select

from app.models.budget import Budget


def create(session: Session, budget: Budget) -> Budget:
    session.add(budget)
    session.commit()
    session.refresh(budget)
    return budget


def get(session: Session, budget_id: int) -> Budget | None:
    return session.get(Budget, budget_id)


def get_by_category(session: Session, category_id: int) -> Budget | None:
    return session.exec(select(Budget).where(Budget.category_id == category_id)).first()


def list_all(session: Session) -> list[Budget]:
    return list(session.exec(select(Budget)).all())


def update(session: Session, budget: Budget) -> Budget:
    session.add(budget)
    session.commit()
    session.refresh(budget)
    return budget


def delete(session: Session, budget: Budget) -> None:
    session.delete(budget)
    session.commit()
