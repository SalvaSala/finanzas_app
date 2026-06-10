"""Business logic for savings goals."""

import datetime as dt

from sqlmodel import Session

from app.models.savings_goal import SavingsGoal
from app.repositories import savings_goal as goal_repo
from app.schemas.savings_goal import (
    SavingsGoalContribute,
    SavingsGoalCreate,
    SavingsGoalRead,
    SavingsGoalUpdate,
)
from app.services.exceptions import NotFoundError


def _to_read(goal: SavingsGoal) -> SavingsGoalRead:
    progress_pct = (
        round(float(goal.current_amount / goal.target_amount * 100), 1)
        if goal.target_amount > 0
        else 0.0
    )
    is_completed = goal.current_amount >= goal.target_amount
    days_remaining: int | None = None
    if goal.deadline is not None:
        days_remaining = (goal.deadline - dt.date.today()).days

    assert goal.id is not None
    return SavingsGoalRead(
        id=goal.id,
        name=goal.name,
        target_amount=goal.target_amount,
        current_amount=goal.current_amount,
        deadline=goal.deadline,
        color=goal.color,
        created_at=goal.created_at,
        progress_pct=progress_pct,
        is_completed=is_completed,
        days_remaining=days_remaining,
    )


def create_goal(session: Session, data: SavingsGoalCreate) -> SavingsGoalRead:
    goal = SavingsGoal(**data.model_dump())
    goal = goal_repo.create(session, goal)
    return _to_read(goal)


def get_goal(session: Session, goal_id: int) -> SavingsGoalRead:
    goal = goal_repo.get(session, goal_id)
    if goal is None:
        raise NotFoundError("El objetivo de ahorro indicado no existe.")
    return _to_read(goal)


def list_goals(session: Session) -> list[SavingsGoalRead]:
    return [_to_read(g) for g in goal_repo.list_all(session)]


def update_goal(session: Session, goal_id: int, data: SavingsGoalUpdate) -> SavingsGoalRead:
    goal = goal_repo.get(session, goal_id)
    if goal is None:
        raise NotFoundError("El objetivo de ahorro indicado no existe.")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(goal, field, value)
    goal = goal_repo.update(session, goal)
    return _to_read(goal)


def delete_goal(session: Session, goal_id: int) -> None:
    goal = goal_repo.get(session, goal_id)
    if goal is None:
        raise NotFoundError("El objetivo de ahorro indicado no existe.")
    goal_repo.delete(session, goal)


def contribute(session: Session, goal_id: int, data: SavingsGoalContribute) -> SavingsGoalRead:
    goal = goal_repo.get(session, goal_id)
    if goal is None:
        raise NotFoundError("El objetivo de ahorro indicado no existe.")
    goal.current_amount = goal.current_amount + data.amount
    goal = goal_repo.update(session, goal)
    return _to_read(goal)
