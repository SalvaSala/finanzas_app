"""Data access for savings goals."""

from sqlmodel import Session, col, select

from app.models.savings_goal import SavingsGoal


def create(session: Session, goal: SavingsGoal) -> SavingsGoal:
    session.add(goal)
    session.commit()
    session.refresh(goal)
    return goal


def get(session: Session, goal_id: int) -> SavingsGoal | None:
    return session.get(SavingsGoal, goal_id)


def list_all(session: Session) -> list[SavingsGoal]:
    return list(session.exec(select(SavingsGoal).order_by(col(SavingsGoal.created_at))).all())


def update(session: Session, goal: SavingsGoal) -> SavingsGoal:
    session.add(goal)
    session.commit()
    session.refresh(goal)
    return goal


def delete(session: Session, goal: SavingsGoal) -> None:
    session.delete(goal)
    session.commit()
